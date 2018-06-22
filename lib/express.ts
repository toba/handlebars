import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { Cache, merge, is, Encoding } from '@toba/tools';

const placeholderHelperName = 'block';
const contentHelperName = 'contentFor';

/**
 * Configuration that applies globally to the Handlebars renderer.
 */
export interface ExpressHandlebarsOptions {
   /**
    * Default layout file name without extension the view templates should be
    * rendered within.
    */
   defaultLayout: string;
   /** Folder within Express `views` containing partials. */
   partialsFolder: string;
   /** Folder within Express `views` containing layouts. */
   layoutsFolder: string;
   /** Whether to cache templates (default is `true`). */
   cacheTemplates: boolean;
   /** File extension the renderer should handle. Default is `hbs`. */
   fileExtension: string;
}

/**
 * Method called when a template has been rendered.
 */
type RenderCallback = (err: Error, output?: string) => void;

/**
 * Values set in the Express application with the `app.set(name, value)`
 * syntax.
 */
interface ExpressSettings {
   /** Absolute path to renderable views including partials and layouts. */
   views: string;
   filename?: string;
   etag: string;
   /** `NODE_ENV` value if set. */
   env: string;
   'view engine': string;
   'x-powered-by': boolean;
   'trust proxy': boolean;
}

/**
 * Context values available within templates and settings passed with each
 * `render()` call.
 */
interface RenderContext {
   [key: string]: any;
   /** Cache flag injected by Express. */
   cache?: boolean;
   settings?: ExpressSettings;
   /**
    * Layout to render content within. Handlebars doesn't support layouts per se
    * so the layout becomes the view template to render with a `body` block
    * that the given view name is assigned to.
    */
   layout?: string;
}

const defaultOptions: ExpressHandlebarsOptions = {
   defaultLayout: 'main',
   partialsFolder: 'partials',
   layoutsFolder: 'layouts',
   cacheTemplates: true,
   fileExtension: 'hbs'
};

/**
 *
 */
export class ExpressHandlebars {
   /** Template file extension that will be handled by this renderer. */
   fileExtension: string;
   private options: ExpressHandlebarsOptions;
   private cache: Cache<Handlebars.TemplateDelegate<any>>;
   private hbs: typeof Handlebars;
   private basePath: string;
   private re: RegExp;
   /**
    * Placeholder blocks defined with `block` helper and populated with the
    * `contentFor` helper.
    */
   private placeHolders: Map<string, string[]>;
   private partialsLoaded = false;
   /**
    * Runtime options can take a hash of precompiled template partials to speed
    * up rendering.
    * @see http://handlebarsjs.com/execution.html
    * @see https://github.com/ericf/express-handlebars/blob/master/lib/express-handlebars.js#L211
    */
   renderOptions: Handlebars.RuntimeOptions;

   /**
    *
    * @param basePath Fully qualified path to views. This duplicates the
    * Express `views` but is available sooner, before a rendering request,
    * allowing earlier caching of templates.
    */
   constructor(options: Partial<ExpressHandlebarsOptions> = {}) {
      this.options = merge(defaultOptions, options);
      this.hbs = Handlebars.create();
      this.cache = new Cache();
      this.fileExtension = this.options.fileExtension;
      this.renderer = this.renderer.bind(this);
      this.registerHelper = this.registerHelper.bind(this);
      this.renderOptions = {};
      this.placeHolders = new Map();
      this.re = new RegExp(`\.${this.fileExtension}$`, 'i');
      this.options.defaultLayout = this.addExtension(
         this.options.defaultLayout
      );
      this.registerPlaceholderHelpers();
   }

   /**
    * Two helpers allow a template region to be defined that other templates
    * can insert into by name.
    */
   private registerPlaceholderHelpers() {
      this.hbs.registerHelper(placeholderHelperName, (name, options) => {
         let content = this.getPlaceholderContent(name);
         if (is.empty(content) && is.callable(options.fn)) {
            content = options.fn(this);
         }
         return content;
      });

      const self = this;

      this.hbs.registerHelper(contentHelperName, function(
         this: RenderContext,
         name,
         options
      ) {
         self.addPlaceholderContent(name, options, this);
      });
   }

   /**
    * Add file name extension.
    */
   private addExtension = (filePath: string): string =>
      is.empty(filePath) || filePath.endsWith(this.fileExtension)
         ? filePath
         : `${filePath}.${this.fileExtension}`;

   /**
    * Extract name of partial (file name without extension) from full path.
    */
   private partialName = (filePath: string): string => {
      const parts = filePath.split(/[/\\]/);
      return parts[parts.length - 1].replace('.' + this.fileExtension, '');
   };

   /**
    * Express standard renderer. Express adds the defined file extention to the
    * view name before passing it.
    *
    * @example
    *    import { ExpressHandlebars } from '@toba/handlebars';
    *    const ehb = new ExpressHandlebars();
    *    app.engine(ehb.name, ehb.renderer);
    *    app.set('views', './views');
    *    app.set('view engine', ehb.name);
    *
    * @see https://expressjs.com/en/advanced/developing-template-engines.html
    */
   async renderer(
      viewPath: string,
      context: RenderContext,
      cb?: RenderCallback
   ) {
      const layout =
         context.layout === undefined
            ? this.options.defaultLayout
            : context.layout;

      this.basePath = context.settings.views;

      if (layout !== null) {
         // render view within the layout, otherwise render without layout
         context.body = await this.loadTemplate(viewPath);
         viewPath = path.join(
            this.basePath,
            this.options.layoutsFolder,
            layout
         );
      }
      this.render(viewPath, context, cb);
   }

   private async render(
      viewPath: string,
      context: RenderContext,
      cb?: RenderCallback
   ) {
      if (!this.partialsLoaded) {
         try {
            await this.loadPartials(this.options.partialsFolder);
            this.partialsLoaded = true;
         } catch (err) {
            cb(err);
         }
      }

      try {
         const template = await this.loadTemplate(viewPath);
         cb(null, template(context));
      } catch (err) {
         cb(err);
      }
   }

   /**
    * Load template from cache or from file system if not cached.
    * @param registerAsPartial Whether to add template to render option
    * partials
    */
   private loadTemplate = (
      filePath: string,
      registerAsPartial = false
   ): Promise<Handlebars.TemplateDelegate> =>
      new Promise((resolve, reject) => {
         if (this.cache.contains(filePath)) {
            resolve(this.cache.get(filePath));
         } else {
            fs.readFile(
               filePath,
               { encoding: Encoding.UTF8 },
               (err: Error, content: string) => {
                  if (err) {
                     reject(err);
                     return;
                  }
                  const template = this.hbs.compile(content);
                  this.cache.add(filePath, template);

                  if (registerAsPartial) {
                     this.hbs.registerPartial(
                        this.partialName(filePath),
                        template
                     );
                  }
                  resolve(template);
               }
            );
         }
      });

   /**
    * Add helper function to template context.
    */
   registerHelper(name: string, fn: Handlebars.HelperDelegate): void;
   /**
    * Add map of helper functions to template context.
    */
   registerHelper(map: { [key: string]: Handlebars.HelperDelegate }): void;
   registerHelper(
      mapOrName: string | { [key: string]: Handlebars.HelperDelegate },
      fn?: Handlebars.HelperDelegate
   ) {
      if (is.text(mapOrName)) {
         this.hbs.registerHelper(name, fn);
      } else {
         Object.keys(mapOrName).forEach(key => {
            this.hbs.registerHelper(key, mapOrName[key]);
         });
      }
   }

   /**
    * Defines a block into which content is inserted via `contentFor`.
    *
    * @example
    * In layout.hbs
    *
    *  {{{block "pageStylesheets"}}}
    */
   getPlaceholderContent(name: string) {
      let content = '';
      if (this.placeHolders.has(name)) {
         content = this.placeHolders.get(name).join('\n');
         this.placeHolders.delete(name);
      }
      return content;
   }

   /**
    * Defines content for a named block declared in layout.
    *
    * @example
    *
    * {{#contentFor "pageStylesheets"}}
    * <link rel="stylesheet" href='{{{URL "css/style.css"}}}' />
    * {{/contentFor}}
    */
   addPlaceholderContent(
      name: string,
      options: Handlebars.HelperOptions,
      context: RenderContext
   ) {
      let ph: string[] = [];
      if (this.placeHolders.has(name)) {
         ph = this.placeHolders.get(name);
      } else {
         this.placeHolders.set(name, ph);
      }
      ph.push(options.fn(context));
   }

   /**
    * Precompile templates in given folders relative to a base path.
    */
   private loadPartials(...folders: string[]): void {
      folders.forEach(async f => {
         const fullPath = path.join(this.basePath, f);
         const files = fs.readdirSync(fullPath);
         await Promise.all(
            files
               .filter(fileName => fileName.endsWith(this.fileExtension))
               .map(fileName =>
                  this.loadTemplate(path.join(fullPath, fileName), true)
               )
         );
      });
   }
}

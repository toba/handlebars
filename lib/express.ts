import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { Cache, merge, is, Encoding } from '@toba/tools';

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
   constructor(
      basePath: string,
      options: Partial<ExpressHandlebarsOptions> = {}
   ) {
      this.options = merge(defaultOptions, options);
      this.hbs = Handlebars.create();
      this.cache = new Cache();
      this.fileExtension = this.options.fileExtension;
      this.renderer = this.renderer.bind(this);
      this.registerHelper = this.registerHelper.bind(this);
      this.renderOptions = {
         partials: {}
      };
      this.re = new RegExp(`\.${this.fileExtension}$`, 'i');
      this.options.defaultLayout = this.addExtension(
         this.options.defaultLayout
      );
      this.basePath = basePath;
      this.loadPartials(this.options.partialsFolder);
   }

   private addExtension = (filePath: string): string =>
      is.empty(filePath) || filePath.endsWith(this.fileExtension)
         ? filePath
         : `${filePath}.${this.fileExtension}`;

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
   renderer(viewPath: string, context: RenderContext, cb?: RenderCallback) {
      const layout =
         context.layout === undefined
            ? this.options.defaultLayout
            : context.layout;

      if (layout !== null) {
         // render view within the layout, otherwise render without layout
         context.body = viewPath;
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
      try {
         const template = await this.loadTemplate(viewPath);
         cb(null, template(context));
      } catch (err) {
         cb(err);
      }
   }

   /**
    * Load template from cache or from file system if not cached.
    * @param addToRenderOptions Whether to add template to render option
    * partials
    */
   private loadTemplate = (
      filePath: string,
      addToRenderOptions = false
   ): Promise<Handlebars.TemplateDelegate> =>
      new Promise((resolve, reject) => {
         const options: Handlebars.RuntimeOptions = this.renderOptions;
         if (this.cache.contains(filePath)) {
            resolve(this.cache.get(filePath));
         } else {
            fs.readFile(filePath, (err: Error, content: Buffer) => {
               if (err) {
                  reject(err);
                  return;
               }
               const template = this.hbs.compile(
                  content.toString(Encoding.UTF8),
                  options
               );
               this.cache.add(filePath, template);
               if (addToRenderOptions) {
                  this.renderOptions.partials[filePath] = template;
               }
               resolve(template);
            });
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
    * Precompile templates in given folders relative to a base path.
    */
   private loadPartials(...folders: string[]): void {
      folders.forEach(f => {
         const fullPath = path.join(this.basePath, f);
         const files = fs.readdirSync(fullPath);
         files
            .filter(fileName => fileName.endsWith(this.fileExtension))
            .forEach(async fileName => {
               await this.loadTemplate(path.join(fullPath, fileName), true);
            });
      });
   }
}

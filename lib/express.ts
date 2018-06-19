import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { Cache, merge, is, Encoding } from '@toba/tools';

/**
 * Configuration that applies globally to the Handlebars renderer.
 */
export interface ExpressHandlebarsOptions {
   /** Default layout the view templates should be rendered within. */
   defaultLayout: string;
   /**
    * Fully qualified path to views. This duplicates the Express `views` but is
    * available sooner, before a rendering request, allowing earlier caching of
    * templates.
    */
   viewPath: string;
   /** Folder within Express `views` containing partials. */
   partialsFolder: string;
   /** Folder within Express `views` containing layouts. */
   layoutsFolder: string;
   /** Whether to cache templates (default is `true`). */
   cacheTemplates: boolean;
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
   defaultLayout: 'main.hbs',
   partialsFolder: 'partials',
   layoutsFolder: 'layouts',
   viewPath: null,
   cacheTemplates: true
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
   /**
    * @see http://handlebarsjs.com/execution.html
    * @see https://github.com/ericf/express-handlebars/blob/master/lib/express-handlebars.js#L211
    */
   renderOptions: Handlebars.RuntimeOptions;

   constructor(options: Partial<ExpressHandlebarsOptions> = {}) {
      this.options = merge(defaultOptions, options);
      this.hbs = Handlebars.create();
      this.cache = new Cache();
      this.fileExtension = 'hbs';
      this.renderer = this.renderer.bind(this);
      this.registerHelper = this.registerHelper.bind(this);

      if (!is.value(this.options.viewPath)) {
         throw new ReferenceError('viewPath option must be defined');
      }

      const partials = this.precompile(
         this.options.viewPath,
         this.options.layoutsFolder,
         this.options.partialsFolder
      );

      if (partials != null) {
         partials.forEach((value, key) => this.cache.add(key, value));
      }
   }

   /**
    * Express standard renderer.
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
         context.body = layout;
         viewPath = layout;
      }
      this.render(viewPath, context, cb);
   }

   private render(
      viewPath: string,
      context: RenderContext,
      cb?: RenderCallback
   ) {
      const options: Handlebars.RuntimeOptions = this.renderOptions;

      if (this.cache.contains(viewPath)) {
         const template = this.cache.get(viewPath);
         cb(null, template(context, options));
      } else {
         fs.readFile(viewPath, (err: Error, content: Buffer) => {
            if (err) {
               return cb(err);
            }
            const template = this.hbs.compile(
               content.toString(Encoding.UTF8),
               options
            );
            this.cache.add(viewPath, template);
            cb(null, template(context, options));
         });
      }
   }

   /**
    * Expose useful methods.
    */
   registerHelper(name: string, fn: Handlebars.HelperDelegate) {
      this.hbs.registerHelper(name, fn);
   }

   /**
    * Precompile templates in given folders relative to a base path.
    */
   private precompile(
      basePath: string,
      ...folders: string[]
   ): Map<string, Handlebars.TemplateDelegate<any>> {
      const found: Map<string, Handlebars.TemplateDelegate<any>> = new Map();
      const options = this.renderOptions;

      folders.forEach(f => {
         const fullPath = path.join(basePath, f);
         const files = fs.readdirSync(fullPath);
         files
            .filter(fileName => fileName.endsWith(this.fileExtension))
            .forEach(fileName => {
               const filePath = path.join(fullPath, fileName);
               const content = fs.readFileSync(filePath);
               const template = this.hbs.compile(
                  content.toString(Encoding.UTF8),
                  options
               );
               found.set(filePath, template);
            });
      });

      return found.size > 0 ? found : null;
   }
}

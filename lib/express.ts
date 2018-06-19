import * as fs from 'fs';
//import * as path from 'path';
import * as Handlebars from 'handlebars';
import { Cache, merge } from '@toba/tools';

export interface ExpressHandlebarsOptions {
   /** Default layout template should be rendered within. */
   defaultLayout: string;
   /** Folder within Express views containing partials. */
   partialsFolder: string;
   /** Folder within Express views containing layouts. */
   layoutsFolder: string;
   /** Whether to cache templates. */
   cacheTemplates: boolean;
}

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

interface RenderContext {
   [key: string]: any;
   /** Cache flag injected by Express. */
   cache?: boolean;
   settings?: ExpressSettings;
   template?: string;
}

const defaultOptions: ExpressHandlebarsOptions = {
   defaultLayout: 'main.hbs',
   partialsFolder: 'partials',
   layoutsFolder: 'layouts',
   cacheTemplates: true
};

/**
 *
 */
export class ExpressHandlebars {
   options: ExpressHandlebarsOptions;
   fileExtension: string;
   cache: Cache<Handlebars.TemplateDelegate<any>>;
   hbs: typeof Handlebars;
   /**
    * @see http://handlebarsjs.com/execution.html
    * @see https://github.com/ericf/express-handlebars/blob/master/lib/express-handlebars.js#L211
    */
   defaultRenderOptions: Handlebars.RuntimeOptions;

   constructor(options: Partial<ExpressHandlebarsOptions> = {}) {
      this.options = merge(defaultOptions, options);
      this.hbs = Handlebars.create();
      this.fileExtension = 'hbs';
      this.cache = new Cache();
      this.renderer = this.renderer.bind(this);
      this.registerHelper = this.registerHelper.bind(this);
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
         context.template === undefined
            ? this.options.defaultLayout
            : context.template;

      if (layout !== null) {
         // render view within the layout
         return this.renderWithinLayout(layout, viewPath, context, cb);
      }

      if (this.cache.contains(viewPath)) {
         const template = this.cache.get(viewPath);
         cb(null, template(context));
      } else {
         fs.readFile(viewPath, (err, content) => {
            if (err) {
               return cb(err);
            }
            const template = this.hbs.compile(content);
            this.cache.add(viewPath, template);
            cb(null, template(context));
         });
      }
   }

   renderWithinLayout(
      layout: string,
      viewPath: string,
      context: RenderContext,
      cb?: RenderCallback
   ) {
      if (this.cache.contains(viewPath)) {
         const template = this.cache.get(viewPath);
         cb(null, template(context));
      } else {
         fs.readFile(viewPath, (err, content) => {
            if (err) {
               return cb(err);
            }
            const template = this.hbs.compile(content);
            this.cache.add(viewPath, template);
            cb(null, template(context));
         });
      }
   }

   /**
    * Expose useful methods.
    */
   registerHelper(name: string, fn: Handlebars.HelperDelegate) {
      this.hbs.registerHelper(name, fn);
   }
}

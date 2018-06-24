import * as Handlebars from 'handlebars';
import { is } from '@toba/tools';
import { RenderContext } from './express';

interface Iterable {
   key: string;
   index: number;
   first: boolean;
   last: boolean;
}

interface EachOptions extends Handlebars.HelperOptions {
   data: Iterable;
}

function placeholder(this: RenderContext, name: string, options: Handlebars.HelperOptions) {
   let content = this.getPlaceholderContent(name);
   if (is.empty(content) && is.callable(options.fn)) {
      content = options.fn(this);
   }
   return content;
}

function each(
   this: RenderContext,
   context: any,
   options: EachOptions
) {
   if (!options) {
      throw Handlebars.Exception('Must pass iterator to #each');
   }

   const fn = options.fn;
   const inverse = options.inverse;
   let i = 0;
   let ret = '';
   let data;

   if (is.callable(context)) {
      context = context.call(this);
   }

   if (options.data) {
      data = createFrame(options.data);
   }

   function execIteration(field, index, last) {
      if (data) {
         data.key = field;
         data.index = index;
         data.first = index === 0;
         data.last = !!last;
      }

      ret =
         ret +
         fn(context[field], {
            data: data,
            blockParams: [context[field], field]
         });
   }

   if (context && typeof context === 'object') {
      if (is.array(context)) {
         for (const j = context.length; i < j; i++) {
            if (i in context) {
               execIteration(i, i, i === context.length - 1);
            }
         }
      } else {
         let priorKey;

         for (const key in context) {
            if (context.hasOwnProperty(key)) {
               // We're running the iterations one step out of sync so we can detect
               // the last iteration without have to scan the object twice and create
               // an itermediate keys array.
               if (priorKey !== undefined) {
                  execIteration(priorKey, i - 1);
               }
               priorKey = key;
               i++;
            }
         }
         if (priorKey !== undefined) {
            execIteration(priorKey, i - 1, true);
         }
      }
   }

   if (i === 0) {
      ret = inverse(this);
   }

   return ret;
})


export const helpers: {[key: string]: Handlebars.HelperDelegate } = {
   each,
   placeholder
};


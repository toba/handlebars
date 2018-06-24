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

export function each(this: RenderContext, context: any, options: EachOptions) {
   if (!is.value(options)) {
      throw Handlebars.Exception('Must pass array, Map or Set to #each');
   }

   const template = options.fn;
   const inverse = options.inverse;
   let i = 0;
   let ret = '';
   let data: any;

   if (is.callable(context)) {
      context = context.call(this);
   }

   if (options.data) {
      data = options.data;
   }

   function execIteration(
      field: string | number,
      index: number,
      last: boolean = false
   ) {
      if (data) {
         data.key = field;
         data.index = index;
         data.first = index === 0;
         data.last = !!last;
      }

      ret =
         ret +
         template(context[field], {
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
}

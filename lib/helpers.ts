import * as Handlebars from 'handlebars';
import { is } from '@toba/tools';

interface Iterable {
   key: string;
   index: number;
   first: boolean;
   last: boolean;
}

interface HelperOptions extends Handlebars.HelperOptions {
   data: Iterable;
}

export function each(instance: typeof Handlebars) {
   instance.registerHelper('each', (context, options: HelperOptions) => {
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
   });
}

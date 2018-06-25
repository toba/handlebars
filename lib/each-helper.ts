import * as Handlebars from 'handlebars';
import { is } from '@toba/tools';
import { RenderContext } from './express';

interface Iterable {
   key: string | number;
   index: number;
   first: boolean;
   last: boolean;
}

interface EachOptions extends Handlebars.HelperOptions {
   data: Iterable;
}

export function each(
   this: RenderContext,
   iterable: Map<any, any> | Set<any> | Array<any> | { [key: string]: any },
   options: EachOptions
) {
   const template = options.fn;
   let content = '';
   let data: Iterable;

   if (!is.value(iterable)) {
      return '';
   }

   if (is.callable(iterable)) {
      iterable = iterable.call(this);
   }

   if (options.data) {
      data = options.data;
   }

   function iterate(
      key: string | number,
      value: any,
      index: number,
      last: boolean = false
   ) {
      if (is.value<Iterable>(data)) {
         data.key = key;
         data.index = index;
         data.first = index === 0;
         data.last = last;
      }

      content += template(value, {
         data,
         blockParams: [value, key]
      });
   }

   let i = 0;

   if (iterable instanceof Map) {
      iterable.forEach((value: any, key: any) => {
         iterate(key, value, i);
         i++;
      });
   } else if (iterable instanceof Set) {
      iterable.forEach(value => {
         iterate(i, value, i);
         i++;
      });
   } else if (is.array(iterable)) {
      iterable.forEach((value, index) => {
         iterate(index, value, index);
      });
   } else if (typeof iterable === is.Type.Object) {
      for (const key in iterable) {
         iterate(key, (iterable as { [key: string]: any })[key], i);
         i++;
      }
   }
   return content;
}

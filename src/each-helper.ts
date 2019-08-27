import * as Handlebars from 'handlebars';
import { is, ValueType } from '@toba/node-tools';
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
      size: number
   ) {
      if (is.value<Iterable>(data)) {
         data.key = key;
         data.index = index;
         data.first = index === 0;
         data.last = index + 1 === size;
      }

      content += template(value, {
         data,
         blockParams: [value, key]
      });
   }

   let i = 0;
   let size = 0;

   if (iterable instanceof Map) {
      size = iterable.size;
      iterable.forEach((value: any, key: any) => {
         iterate(key, value, i, size);
         i++;
      });
   } else if (iterable instanceof Set) {
      size = iterable.size;
      iterable.forEach(value => {
         iterate(i, value, i, size);
         i++;
      });
   } else if (is.array(iterable)) {
      size = iterable.length;
      iterable.forEach((value, index) => {
         iterate(index, value, index, size);
      });
   } else if (typeof iterable === ValueType.Object) {
      size = Object.keys(iterable).length;
      for (const key in iterable) {
         iterate(key, (iterable as { [key: string]: any })[key], i, size);
         i++;
      }
   }
   return content;
}

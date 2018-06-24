import * as Handlebars from 'handlebars';
import { is } from '@toba/tools';
import { RenderContext } from './express';

/**
 * Placeholder blocks defined with `placeholder` helpers and populated with the
 * `placeholderContent` helper. Multiple blocks can target the same placeholder
 * so the content is an array.
 */
export const contentMap: Map<string, string[]> = new Map();

/**
 * Defines a block into which content is inserted from a `placeholderContent`
 * block. For example, if the helper is named "block":
 *
 * @example
 *
 *  {{{block "pageStylesheets"}}}
 */
export function placeholder(
   this: RenderContext,
   name: string,
   options: Handlebars.HelperOptions
): string {
   let content = getContent(name);
   if (is.empty(content) && is.callable(options.fn)) {
      content = options.fn(this);
   }
   return content;
}

/**
 * Defines content for a named block declared in layout. For example, if the
 * helper is named "contentFor":
 *
 * @example
 *
 * {{#contentFor "pageStylesheets"}}
 * <link rel="stylesheet" href='{{{URL "css/style.css"}}}' />
 * {{/contentFor}}
 */
export function placeholderContent(
   this: RenderContext,
   name: string,
   options: Handlebars.HelperOptions
) {
   addContent(name, options.fn, this);
}

/**
 * Retrieve content for a particular placeholder, joining with `\n`.
 */
export function getContent(key: string): string {
   let content = '';
   if (contentMap.has(key)) {
      content = contentMap.get(key).join('\n');
      contentMap.delete(key);
   }
   return content;
}

/**
 * Add rendered content to placeholder.
 * @param key
 * @param template Template that will render the content.
 * @param context Template context.
 */
export function addContent(
   key: string,
   template: Handlebars.TemplateDelegate<any>,
   context?: RenderContext
) {
   let content: string[] = [];
   if (contentMap.has(key)) {
      content = contentMap.get(key);
   } else {
      contentMap.set(key, content);
   }
   content.push(template(context));
}

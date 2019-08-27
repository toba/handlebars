import '@toba/test';
import { sayNumber } from '@toba/node-tools';
import * as Handlebars from 'handlebars';
import { placeholder, placeholderContent } from './helpers';
import { contentMap, addContent, getContent } from './placeholder-helper';

const hbs = Handlebars.create();
hbs.registerHelper('block', placeholder);
hbs.registerHelper('contentFor', placeholderContent);

beforeEach(() => {
   contentMap.clear();
});

/**
 * @param placeholderName Name of the placeholder
 * @param count Number of content items to add
 */
function addMockTextContent(
   placeholderName: string = 'mock',
   count: number = 2
) {
   for (let i = 1; i <= count; i++) {
      addContent(
         placeholderName,
         hbs.compile(`${placeholderName} content ${sayNumber(i)}`)
      );
   }
}

function expectedContent(
   placeholderName: string = 'mock',
   count: number = 2
): string {
   const content = [];
   for (let i = 1; i <= count; i++) {
      content.push(`${placeholderName} content ${sayNumber(i)}`);
   }
   return content.join('\n');
}

test('adds content to placeholder map', () => {
   expect(contentMap.size).toBe(0);
   addMockTextContent('mock1');
   addMockTextContent('mock2');
   expect(contentMap.size).toBe(2);
   expect(contentMap.get('mock1')).toBeInstanceOf(Array);
   expect(contentMap.get('mock1')).toHaveLength(2);
});

test('removes content from map when accessed', () => {
   const name = 'mock';
   addMockTextContent(name, 2);
   expect(contentMap.size).toBe(1);
   expect(getContent(name)).toBe(expectedContent(name, 2));
   expect(contentMap.size).toBe(0);
});

test('injects content into placeholder', () => {
   const template = hbs.compile('my great page {{{block "mock"}}}');
   addMockTextContent('mock', 2);
   expect(template({})).toMatchSnapshot();
});

test('injects multiple contents into placeholders', () => {
   const template = hbs.compile(
      'my great page {{{block "mock1"}}}\nnext line {{{block "mock2"}}}'
   );
   addMockTextContent('mock1', 2);
   addMockTextContent('mock2', 4);
   // no error if targeting non-existent placeholder
   addMockTextContent('mock3', 4);
   expect(template({})).toMatchSnapshot();
});

import '@toba/test';
import * as Handlebars from 'handlebars';
import { each } from './helpers';

const html = `
<div>
   <ul>
{{#each entity}}
      <li>{{this.key1}} and {{this.key2}}</li>
{{/each}}
   </ul>
</div>`;
const output = `
<div>
   <ul>
      <li>first part 1 and first part 2</li>
      <li>second part 1 and second part 2</li>
   </ul>
</div>`;
const hbs = Handlebars.create();

hbs.registerHelper('each', each);

function render(
   entity: Array<any> | Map<any, any> | Set<any> | { [key: string]: any }
) {
   const template = hbs.compile(html);
   expect(template({ entity })).toBe(output);
}

test('iterates over arrays', () => {
   render([
      { key1: 'first part 1', key2: 'first part 2' },
      { key1: 'second part 1', key2: 'second part 2' }
   ]);
});

test('iterates over objects', () => {
   render({
      one: { key1: 'first part 1', key2: 'first part 2' },
      two: { key1: 'second part 1', key2: 'second part 2' }
   });
});

test('iterates over maps', () => {
   const entity: Map<string, any> = new Map();
   entity.set('one', { key1: 'first part 1', key2: 'first part 2' });
   entity.set('two', { key1: 'second part 1', key2: 'second part 2' });
   render(entity);
});

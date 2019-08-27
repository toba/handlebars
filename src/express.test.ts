import '@toba/test';
import * as path from 'path';
import Express = require('express');
import request = require('supertest');
import { ExpressHandlebars } from '.';
import { HttpStatus } from '@toba/node-tools';

const viewPath = path.join(__dirname, '__mocks__', 'views');
const app = Express();
const items = [{ name: 'one' }, { name: 'two' }, { name: 'three' }];

beforeAll(() => {
   const ehb = new ExpressHandlebars();
   app.set('views', viewPath);
   app.set('view engine', ehb.fileExtension);
   app.engine(ehb.fileExtension, ehb.renderer);
});

function makeRoute(path: string, viewName: string, layout?: string) {
   app.get(path, (_req: Express.Request, res: Express.Response) => {
      res.render(
         viewName,
         { items, title: 'Mockery', layout },
         (err: Error, html: string) => {
            expect(err).toBeNull();
            res.write(html);
            res.end();
         }
      );
   });
}

test('renders body with partial within layout', async () => {
   makeRoute('/body-with-partial', 'partial');
   const res = await request(app).get('/body-with-partial');
   expect(res.status).toBe(HttpStatus.OK);
   expect(res.text).toMatchSnapshot();
});

test('renders without layout', async () => {
   makeRoute('/', 'home');
   const res = await request(app).get('/');
   expect(res.status).toBe(HttpStatus.OK);
   expect(res.text).toMatchSnapshot();
});

test('renders within default layout', async () => {
   makeRoute('/home', 'home');
   const res = await request(app).get('/home');
   expect(res.status).toBe(HttpStatus.OK);
   expect(res.text).toMatchSnapshot();
});

test('renders within specified layout', async () => {
   makeRoute('/other', 'home', 'other');
   const res = await request(app).get('/other');
   expect(res.status).toBe(HttpStatus.OK);
   expect(res.text).toMatchSnapshot();
});

test('renders data', async () => {
   makeRoute('/bare-data', 'data');
   const res = await request(app).get('/bare-data');
   expect(res.status).toBe(HttpStatus.OK);
   expect(res.text).toMatchSnapshot();
});

test('renders data within layout', async () => {
   makeRoute('/data', 'data');
   const res = await request(app).get('/data');
   expect(res.status).toBe(HttpStatus.OK);
   expect(res.text).toMatchSnapshot();
});

import '@toba/test';
import * as path from 'path';
import * as Express from 'express';
import * as request from 'supertest';
import { ExpressHandlebars } from './';
import { HttpStatus } from '@toba/tools';

const viewPath = path.join(__dirname, '__mocks__', 'views');
const app = Express();

beforeAll(() => {
   const ehb = new ExpressHandlebars(viewPath);
   app.set('views', viewPath);
   app.set('view engine', ehb.fileExtension);
   app.engine(ehb.fileExtension, ehb.renderer);
});

function makeRoute(path: string, viewName: string, layout?: string) {
   app.get(path, (_req: Express.Request, res: Express.Response) => {
      res.render(
         viewName,
         { key: 'value', layout },
         (err: Error, html: string) => {
            expect(err).toBeNull();
            res.write(html);
            res.end();
         }
      );
   });
}

test(
   'renders without layout',
   async () => {
      makeRoute('/', 'home', null);
      const res = await request(app).get('/');
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.text).toMatchSnapshot();
   },
   10000
);

test(
   'renders within layout',
   async () => {
      makeRoute('/home', 'home');
      const res = await request(app).get('/home');
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.text).toMatchSnapshot();
   },
   10000
);

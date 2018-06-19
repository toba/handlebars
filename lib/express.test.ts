import '@toba/test';
import * as path from 'path';
import * as Express from 'express';
import * as request from 'supertest';
import { ExpressHandlebars } from './';
import { HttpStatus } from '@toba/tools';

const viewPath = path.join(__dirname, '__mocks__', 'views');
const app = Express();

beforeAll(() => {
   const ehb = new ExpressHandlebars({ viewPath });
   app.set('views', viewPath);
   app.set('view engine', ehb.fileExtension);
   app.engine(ehb.fileExtension, ehb.renderer);
});

function makeRoute(path: string, viewName: string, layout: string = null) {
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
test('validates options', () => {
   let err: Error;
   let ehb: ExpressHandlebars;

   try {
      ehb = new ExpressHandlebars();
   } catch (e) {
      err = e;
   }
   expect(ehb).toBeUndefined();
   expect(err.message).toBe('viewPath option must be defined');
});
test('creates stuff', async () => {
   makeRoute('/', 'home.hbs');
   const res = await request(app).get('/');
   expect(res.status).toBe(HttpStatus.OK);
   expect(res.text).toMatchSnapshot();
});

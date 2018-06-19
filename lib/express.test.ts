import '@toba/test';
import * as path from 'path';
import * as Express from 'express';
import * as request from 'supertest';
import { ExpressHandlebars } from './';
import { HttpStatus } from '@toba/tools';

const app = Express();

test('creates stuff', async () => {
   const views = path.join(__dirname, '__mocks__', 'views');
   const ehb = new ExpressHandlebars();
   app.set('views', views);
   app.set('view engine', ehb.fileExtension);
   app.engine(ehb.fileExtension, ehb.renderer);
   app.get('/', (_req: Express.Request, res: Express.Response) => {
      res.render('home.hbs', { key: 'value' }, (err: Error, html: string) => {
         expect(err).toBeUndefined();
         res.write(html);
         res.end();
      });
   });

   const res = await request(app).get('/');
   expect(res.status).toBe(HttpStatus.OK);
});

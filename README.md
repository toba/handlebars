[![npm package](https://img.shields.io/npm/v/@toba/handlebars.svg)](https://www.npmjs.org/package/@toba/handlebars)
[![Build Status](https://travis-ci.org/toba/handlebars.svg?branch=master)](https://travis-ci.org/toba/handlebars)
![Code style](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)
[![Dependencies](https://img.shields.io/david/toba/handlebars.svg)](https://david-dm.org/toba/handlebars)
[![DevDependencies](https://img.shields.io/david/dev/toba/handlebars.svg)](https://david-dm.org/toba/handlebars#info=devDependencies&view=list)
[![codecov](https://codecov.io/gh/toba/handlebars/branch/master/graph/badge.svg)](https://codecov.io/gh/toba/handlebars)

# Usage

```
yarn add @toba/handlebars
```

## Express

```ts
import { ExpressHandlebars } from '@toba/handlebars';
const ehb = new ExpressHandlebars();
app.engine(ehb.name, ehb.renderer);
app.set('views', './views');
app.set('view engine', ehb.name);
```

## Koa

## Fastify

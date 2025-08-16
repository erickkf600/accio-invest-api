import Route from '@ioc:Adonis/Core/Route'
import Change from 'App/Models/Change'
import Month from 'App/Models/Month'
import Operation from 'App/Models/Operation'
import Type from 'App/Models/Type'
import User from 'App/Models/User'

Route.get("/", () => "ACCIO INVEST API");

Route.get("/months", async () => await Month.query().orderBy('num'));
Route.get("/users", async () => await User.query().select('id', 'name', 'user', 'email'));
Route.get("/assets", async () => await Type.query().select('id', 'title', 'full_title'));
Route.get("/operation-types", async () => await Operation.query().select('id', 'title', 'full_title'));
Route.get("/split-types", async () => await Change.query().select('id', 'change_type', 'change_type_title'));


//FILTERS
Route.get("/moviments/search/", async (ctx) => {
  const { default: InvestmentsMovementsController } = await import(
    "App/Controllers/Http/InvestmentsMovementsController"
  );
  return new InvestmentsMovementsController().searchItems(ctx);
});

Route.get("/moviments/:year/:type", async (ctx) => {
  const { default: InvestmentsMovementsController } = await import(
    "App/Controllers/Http/InvestmentsMovementsController"
  );
  return new InvestmentsMovementsController().showFilteredItemsByType(ctx);
});

//HOME
Route.get("/home/resume", async (ctx) => {
  const { default: HomeController } = await import(
    "App/Controllers/Http/HomeController"
  );
  return new HomeController().showHome(ctx);
});
Route.get("/home/cdi/:year", async (ctx) => {
  const { default: HomeController } = await import(
    "App/Controllers/Http/HomeController"
  );
  return new HomeController().getCDIComparation(ctx);
});
Route.get("/home/evolution/:type", async (ctx) => {
  const { default: HomeController } = await import(
    "App/Controllers/Http/HomeController"
  );
  return new HomeController().getPatrimonyEvolution(ctx);
});
Route.get("/home/evolution/chart", async () => {
  const { default: HomeController } = await import(
    "App/Controllers/Http/HomeController"
  );
  return new HomeController().quarterlyData();
});
Route.get("/home/aports/:year", async (ctx) => {
  const { default: HomeController } = await import(
    "App/Controllers/Http/HomeController"
  );
  return new HomeController().AportsGraph(ctx);
});


Route.get("/wallet/assets-list", async () => {
  const { default: InvestmentsWalletsController } = await import(
    "App/Controllers/Http/InvestmentsWalletsController"
  );
  return new InvestmentsWalletsController().assetsList();
});

Route.get("/wallet/dividends-list", async () => {
  const { default: InvestmentsWalletsController } = await import(
    "App/Controllers/Http/InvestmentsWalletsController"
  );
  return new InvestmentsWalletsController().dividendsList();
});
Route.get("/wallet/patrimony-gain", async () => {
  const { default: InvestmentsWalletsController } = await import(
    "App/Controllers/Http/InvestmentsWalletsController"
  );
  return new InvestmentsWalletsController().patrimonyGainList();
});
Route.get("/wallet/variations", async () => {
  const { default: InvestmentsWalletsController } = await import(
    "App/Controllers/Http/InvestmentsWalletsController"
  );
  return new InvestmentsWalletsController().VariationsList();
});

Route.get("/wallet/dividends-graph/:year", async (ctx) => {
  const { default: InvestmentsWalletsController } = await import(
    "App/Controllers/Http/InvestmentsWalletsController"
  );
  return new InvestmentsWalletsController().DividendsGraph(ctx);
});

Route.post("/wallet/ticker-earnings", async (ctx) => {
  const { default: InvestmentsWalletsController } = await import(
    "App/Controllers/Http/InvestmentsWalletsController"
  );
  return new InvestmentsWalletsController().earnings(ctx);
});

Route.get("/moviments/list/:page/:limit", async (ctx) => {
  const { default: InvestmentsMovementsController } = await import(
    "App/Controllers/Http/InvestmentsMovementsController"
  );
  return new InvestmentsMovementsController().show(ctx);
});

Route.get("/moviments/:year", async (ctx) => {
  const { default: InvestmentsMovementsController } = await import(
    "App/Controllers/Http/InvestmentsMovementsController"
  );
  return new InvestmentsMovementsController().showByYear(ctx);
});

Route.get("/moviments/:year/:page/:limit", async (ctx) => {
  const { default: InvestmentsMovementsController } = await import(
    "App/Controllers/Http/InvestmentsMovementsController"
  );
  return new InvestmentsMovementsController().showByYearPaginated(ctx);
});
Route.post("/moviments", async (ctx) => {
  const { default: InvestmentsMovementsController } = await import(
    "App/Controllers/Http/InvestmentsMovementsController"
  );
  return new InvestmentsMovementsController().register(ctx);
});

Route.patch("/moviments/:id", async (ctx) => {
  const { default: InvestmentsMovementsController } = await import(
    "App/Controllers/Http/InvestmentsMovementsController"
  );
  return new InvestmentsMovementsController().update(ctx);
});
Route.delete("/moviments/:id", async (ctx) => {
  const { default: InvestmentsMovementsController } = await import(
    "App/Controllers/Http/InvestmentsMovementsController"
  );
  return new InvestmentsMovementsController().deleteMov(ctx);
});

Route.post("/moviments/split", async (ctx) => {
  const { default: InvestmentsMovementsController } = await import(
    "App/Controllers/Http/InvestmentsMovementsController"
  );
  return new InvestmentsMovementsController().registerSplit(ctx);
});



Route.get("/estimate/list", async () => {
  const { default: EstimatesController } = await import(
    "App/Controllers/Http/EstimatesController"
  );
  return new EstimatesController().show();
});


Route.post("/reports/medium-price", async (ctx) => {
  const { default: InvestmentsReportsController } = await import(
    "App/Controllers/Http/InvestmentsReportsController"
  );
  return new InvestmentsReportsController().pmHistory(ctx);
});

Route.get("/reports/history-aports", async () => {
  const { default: InvestmentsReportsController } = await import(
    "App/Controllers/Http/InvestmentsReportsController"
  );
  return new InvestmentsReportsController().aportsHistory();
});



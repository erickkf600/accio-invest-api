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

Route.get("/wallet/resume", async () => {
  const { default: InvestmentsWalletsController } = await import(
    "App/Controllers/Http/InvestmentsWalletsController"
  );
  return new InvestmentsWalletsController().resume();
});

Route.get("/wallet/fixed-incoming", async () => {
  const { default: InvestmentsWalletsController } = await import(
    "App/Controllers/Http/InvestmentsWalletsController"
  );
  return new InvestmentsWalletsController().fixedIcomingHist();
});

Route.get("/wallet/composition", async () => {
  const { default: InvestmentsWalletsController } = await import(
    "App/Controllers/Http/InvestmentsWalletsController"
  );
  return new InvestmentsWalletsController().compositionList();
});

Route.get("/wallet/assets-list", async () => {
  const { default: InvestmentsWalletsController } = await import(
    "App/Controllers/Http/InvestmentsWalletsController"
  );
  return new InvestmentsWalletsController().assetsList();
});

Route.get("/wallet/rentability/:year", async (ctx) => {
  const { default: InvestmentsWalletsController } = await import(
    "App/Controllers/Http/InvestmentsWalletsController"
  );
  return new InvestmentsWalletsController().rentability(ctx);
});

Route.get("/wallet/dividends-list", async (ctx) => {
  const { default: InvestmentsWalletsController } = await import(
    "App/Controllers/Http/InvestmentsWalletsController"
  );
  return new InvestmentsWalletsController().dividendsList(ctx);
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

Route.get("/wallet/fixed-rentability", async (ctx) => {
  const { default: InvestmentsWalletsController } = await import(
    "App/Controllers/Http/InvestmentsWalletsController"
  );
  return new InvestmentsWalletsController().fixedRentability(ctx);
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
Route.post("/moviments/fixed-incoming", async (ctx) => {
  const { default: InvestmentsMovementsController } = await import(
    "App/Controllers/Http/InvestmentsMovementsController"
  );
  return new InvestmentsMovementsController().registerFixedIncoming(ctx);
});
Route.post("/moviments/fixed-incoming/rendiment", async (ctx) => {
  const { default: InvestmentsMovementsController } = await import(
    "App/Controllers/Http/InvestmentsMovementsController"
  );
  return new InvestmentsMovementsController().registerFixedIncomingRendiment(ctx);
});
Route.patch("/moviments/fixed-incoming/:id", async (ctx) => {
  const { default: InvestmentsMovementsController } = await import(
    "App/Controllers/Http/InvestmentsMovementsController"
  );
  return new InvestmentsMovementsController().updateFixedIncome(ctx);
});
Route.patch("/moviments/fixed-incoming/rendiment/:id", async (ctx) => {
  const { default: InvestmentsMovementsController } = await import(
    "App/Controllers/Http/InvestmentsMovementsController"
  );
  return new InvestmentsMovementsController().updateFixedIncomingRendiment(ctx);
});
Route.delete("/moviments/fixed-incoming/:id", async (ctx) => {
  const { default: InvestmentsMovementsController } = await import(
    "App/Controllers/Http/InvestmentsMovementsController"
  );
  return new InvestmentsMovementsController().deleteFixedIncome(ctx);
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


Route.get("/estimate/list", async () => {
  const { default: EstimatesController } = await import(
    "App/Controllers/Http/EstimatesController"
  );
  return new EstimatesController().show();
});


Route.get("/reports/history-aports", async () => {
  const { default: InvestmentsReportsController } = await import(
    "App/Controllers/Http/InvestmentsReportsController"
  );
  return new InvestmentsReportsController().aportsHistory();
});
Route.get("/reports/rent-history", async (ctx) => {
  const { default: InvestmentsReportsController } = await import(
    "App/Controllers/Http/InvestmentsReportsController"
  );
  return new InvestmentsReportsController().rentHistory(ctx);
});
Route.get("/reports/sell-history", async (ctx) => {
  const { default: InvestmentsReportsController } = await import(
    "App/Controllers/Http/InvestmentsReportsController"
  );
  return new InvestmentsReportsController().sellHistory(ctx);
});
Route.get("/reports/unfolding-history", async (ctx) => {
  const { default: InvestmentsReportsController } = await import(
    "App/Controllers/Http/InvestmentsReportsController"
  );
  return new InvestmentsReportsController().unfoldHistory(ctx);
});
Route.post("/reports/medium-price", async (ctx) => {
  const { default: InvestmentsReportsController } = await import(
    "App/Controllers/Http/InvestmentsReportsController"
  );
  return new InvestmentsReportsController().pmHistory(ctx);
});
Route.post("/reports/upload/brokerage", async (ctx) => {
  const { default: InvestmentsReportsController } = await import(
    "App/Controllers/Http/InvestmentsReportsController"
  );
  return new InvestmentsReportsController().uploadBrokerage(ctx);
});

Route.get("/reports/fixed-incoming", async (ctx) => {
  const { default: InvestmentsReportsController } = await import(
    "App/Controllers/Http/InvestmentsReportsController"
  );
  return new InvestmentsReportsController().fixedIcomingHist(ctx);
});
Route.get("/reports/brokerage-invoices", async (ctx) => {
  const { default: InvestmentsReportsController } = await import(
    "App/Controllers/Http/InvestmentsReportsController"
  );
  return new InvestmentsReportsController().getInvoicesList(ctx);
});




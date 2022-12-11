import Route from "@ioc:Adonis/Core/Route";
import Month from 'App/Models/Month'
import User from 'App/Models/User'
import Type from 'App/Models/Type'
import Operation from 'App/Models/Operation'

Route.get("/", () => "ACCIO INVEST API");

Route.get("/months", async () => await Month.query().orderBy('num'));
Route.get("/users", async () => await User.query().select('id', 'name', 'user', 'email'));
Route.get("/assets", async () => await Type.query().select('id', 'title', 'full_title'));
Route.get("/operation-types", async () => await Operation.query().select('id', 'title', 'full_title'));


Route.get("/wallet/hostory-aports/:year", async (ctx) => {
  const { default: InvestmentsWalletsController } = await import(
    "App/Controllers/Http/InvestmentsWalletsController"
  );
  return new InvestmentsWalletsController().aportsHistory(ctx);
});

Route.get("/wallet/assets-list", async () => {
  const { default: InvestmentsWalletsController } = await import(
    "App/Controllers/Http/InvestmentsWalletsController"
  );
  return new InvestmentsWalletsController().assetsList();
});

Route.get("/moviments/", async () => {
  const { default: InvestmentsMovementsController } = await import(
    "App/Controllers/Http/InvestmentsMovementsController"
  );
  return new InvestmentsMovementsController().show();
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
Route.post("/moviments/", async (ctx) => {
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



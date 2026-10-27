import { AppController } from "./controllers/AppController.js";

/** Ponto de entrada do cliente (View layer da arquitetura MVC). */
const root = document.getElementById("app");
if (root) {
  void new AppController(root).start();
}

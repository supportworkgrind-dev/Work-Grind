export function shouldReloadForServiceWorkerControllerChange(
  hadControllerBeforeRegistration: boolean,
  alreadyReloadedForController: boolean,
): boolean {
  return hadControllerBeforeRegistration && !alreadyReloadedForController;
}

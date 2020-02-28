import ProxyStoreBase from "./base";
import * as fs from "fs";

type PrettyOption = Parameters<JSON["stringify"]>[2] | boolean;

interface Options<T extends object> {
  path: string;
  init?: T | boolean;
  pretty?: PrettyOption;
  watch?: boolean;
}

function readJSON<T = any>(path: string, fallback?: T): T {
  try {
    const json = fs.readFileSync(path).toString();
    return JSON.parse(json);
  } catch (e) {
    if (typeof fallback === "undefined") throw e;
    return fallback;
  }
}

function writeJSON(
  path: string,
  obj: any,
  { pretty }: { pretty?: PrettyOption } = {}
) {
  if (pretty === true) pretty = 2;
  else if (pretty === false) pretty = undefined;
  fs.writeFileSync(path, JSON.stringify(obj, null, pretty));
}

export default class ProxyStore<T extends object> extends ProxyStoreBase<T> {
  private declare path: string;
  public declare pretty: PrettyOption;
  public declare watcher?: fs.FSWatcher;

  constructor(
    root: T = {} as T,
    { init = false, path, pretty = false, watch = false }: Options<T> = {
      path: ""
    }
  ) {
    if (typeof path !== "string" || !path) {
      throw TypeError(`Invalid option path="${path}"`);
    }
    let r = root;
    if (init) {
      r = readJSON(path, r);
    }
    super(r);
    this.path = path;
    this.pretty = pretty;
    if (watch) {
      this.watcher = fs.watch(this.path, () => this.load());
    }
  }

  load() {
    this._root = readJSON(this.path, this._root);
  }

  async save() {
    writeJSON(this.path, this._root, { pretty: this.pretty });
  }

  //@ts-ignore
  set(path: PropertyKey[], prop: PropertyKey, val: any) {
    const ret = prop === ProxyStore.ROOT ? true : super.set(path, prop, val);
    this.save();
    return ret;
  }

  //@ts-ignore
  deleteProperty(path: PropertyKey[], prop: PropertyKey) {
    const ret = super.deleteProperty(path, prop);
    this.save();
    return ret;
  }
}

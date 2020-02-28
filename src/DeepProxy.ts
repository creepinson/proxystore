type HookKey = keyof ProxyHandler<any>;
const hookKeys = Object.getOwnPropertyNames(Reflect) as HookKey[];

type HookMap = {
  [hook in HookKey]?: (
    p: PropertyKey[],
    ...args: any[]
  ) => ReturnType<Required<ProxyHandler<any>>[hook]>;
};

class DeepProxy<T extends object = any> {
  private readonly _paths: WeakMap<object, PropertyKey[]> = new WeakMap();
  protected _root: T;
  private readonly _handler: ProxyHandler<any>;
  public readonly proxy: T;

  constructor(root: T = {} as T) {
    if (typeof root !== "object") {
      throw TypeError("Root value has to be of type object");
    }
    this._root = root;

    const handler: ProxyHandler<any> = {};
    for (const hook of hookKeys) {
      handler[hook] = (t: any, ...args: any[]) => {
        const path = this._paths.get(t);
        if (!path) throw Error("Path not found");
        //console.log(hook, ["root", ...path].join("."));
        return this[hook](
          path,
          //@ts-ignore
          ...args
        );
      };
    }
    this._handler = handler;

    this.proxy = this.addPath([], Object.getPrototypeOf(this._root));
  }

  protected addPath(path: PropertyKey[], proto: object | null) {
    const t = Array.isArray(proto) ? [] : Object.create(proto);
    this._paths.set(t, path);
    return new Proxy(t, this._handler);
  }

  getByPath(path: PropertyKey[]) {
    try {
      const obj = path.reduce((o, k) => o[k], this._root as any);
      if (!obj) throw Error();
      return obj;
    } catch (e) {
      /* istanbul ignore next */
      throw Error(
        `Trying to access property ${path.join(
          "."
        )} failed. Probably because it was removed.`
      );
    }
  }

  /** Always configurable to comply with:
   * > A property cannot be reported as non-configurable, if it does not exists as an own property of the target object or if it exists as a configurable own property of the target object.
   * > https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/getOwnPropertyDescriptor (Invariants)
   * */
  getOwnPropertyDescriptor(
    path: PropertyKey[],
    prop: PropertyKey
  ): PropertyDescriptor | undefined {
    const target = this.getByPath(path);
    const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
    if (!descriptor) return undefined;
    return Object.assign(descriptor, { configurable: true });
  }

  get(path: PropertyKey[], prop: PropertyKey): any {
    const target = this.getByPath(path);
    const val: unknown = Reflect.get(target, prop);
    if (typeof val === "object" && val) {
      return this.addPath([...path, prop], Object.getPrototypeOf(val));
    }
    return val;
  }
}
/** Extends the defined DeepProxy by adding all other possible hooks */
interface DeepProxy extends Required<HookMap> {}
for (const key of Object.getOwnPropertyNames(Reflect) as HookKey[]) {
  // Ignore already defined hooks
  if (DeepProxy.prototype[key]) continue;

  // Create hook for all other traps
  DeepProxy.prototype[key] = function(
    this: DeepProxy,
    path: PropertyKey[],
    ...args: any[]
  ) {
    const target = this.getByPath(path);
    return Reflect[key](
      target,
      //@ts-ignore typescript miscalculates the length of args
      ...args
    );
  };
}

export default DeepProxy;

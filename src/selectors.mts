import { count } from "console";

export interface Selector<T> {
  select(): T;
}

type WeightedSelectable<T> = [number, T];

function isWeightedSelectable<T>(x: any): x is WeightedSelectable<T> {
  return (x instanceof Array) && x.length === 2 && typeof x[0] === 'number';
}

function hasWeightedSelectables<T>(
  x: Iterable<any>
): x is Iterable<WeightedSelectable<T>> {
  for (const elem of x) return isWeightedSelectable(elem);
  return false;
}

function getSize(list: Iterable<any>): number {
  if (list instanceof Array) return list.length;
  if (list instanceof Map || list instanceof Set) return list.size;

  let counter = 0;
  for (const _ of list) ++counter;
  return counter;
}

export class RandomSelector<T> implements Selector<T> {
  private readonly _items: WeightedSelectable<T>[] = [];

  constructor(items: Iterable<WeightedSelectable<T>> | Iterable<T>) {
    if (hasWeightedSelectables(items)) {
      let totalWeight = 0;
      for (const [weight,] of items) totalWeight += weight;
      for (const [weight, value] of items) {
        this._items.push([weight / totalWeight, value]);
      }
    } else {
      const weight = 1 / getSize(items);
      for (const item of items) {
        this._items.push([weight, item]);
      }
    }
  }

  select(): T {
    let roll = Math.random();
    for (const [weight, item] of this._items) {
      roll -= weight;
      if (roll <= 0) return item;
    }
    return this._items[this._items.length - 1][1];
  }
}

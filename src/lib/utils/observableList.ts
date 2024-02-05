import { useCallback, useEffect, useState } from 'react';

export class ObservableList<T> {
  private _array: Array<T> = [];
  private _listeners: Array<(array: Array<T>) => void> = [];
  constructor(initialValue: Array<T> = []) {
    this._array = initialValue;
  }
  get() {
    return this._array;
  }
  add(item: T) {
    this._array.push(item);
    this._listeners.forEach((listener) => listener(this.get()));
  }
  remove(item: T) {
    const itemIndex = this._array.indexOf(item);
    if (itemIndex >= 0) {
      this._array.splice(itemIndex, 1);
      this._listeners.forEach((listener) => listener(this.get()));
    }
  }
  subscribe(onChangeCallback: (array: Array<T>) => void) {
    this._listeners.push(onChangeCallback);
  }
  unsubscribe(onChangeCallback: (array: Array<T>) => void) {
    const onChangeCallbackIndex = this._listeners.indexOf(onChangeCallback);
    if (onChangeCallbackIndex >= 0) {
      this._listeners.splice(onChangeCallbackIndex, 1);
    }
  }
}

// this hook can receive an initial array state or a whole observable list
// an observable list can be used to use this list across multiple components
export function useObservableList<T>(
  initialValue: ObservableList<T> | Array<T> | undefined
): [
  Array<T>,
  { add: ObservableList<T>['add']; remove: ObservableList<T>['remove'] }
] {
  const [observableList] = useState(() => {
    return typeof initialValue === 'object' && !Array.isArray(initialValue)
      ? // use given observable list
        initialValue
      : // create new observable list from value
        new ObservableList<T>(initialValue);
  });
  const [list, setList] = useState(() => observableList.get());
  useEffect(() => {
    const setListWithNewReference = (list: T[]) => setList([...list]);
    observableList.subscribe(setListWithNewReference);
    return () => observableList.unsubscribe(setListWithNewReference);
  }, [observableList]);
  return [
    list,
    {
      add: useCallback((item: T) => observableList.add(item), [observableList]),
      remove: useCallback(
        (item: T) => observableList.remove(item),
        [observableList]
      ),
    },
  ];
}

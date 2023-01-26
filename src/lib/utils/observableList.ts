export class ObservableList<T> {
  private _array: Array<T> = [];
  private _listeners: Array<(array: Array<T>) => void> = [];
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

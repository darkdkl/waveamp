export class PresetPlaylist {
  private history: number[] = [];
  private position = -1;

  constructor(
    private readonly count: number,
    private readonly random: () => number = Math.random
  ) {}

  get current(): number | null {
    return this.position >= 0 ? this.history[this.position] : null;
  }

  next(): number | null {
    if (this.count === 0) return null;
    if (this.position < this.history.length - 1) {
      this.position += 1;
      return this.history[this.position];
    }
    const previous = this.current;
    let index = Math.floor(this.random() * this.count);
    if (this.count > 1 && index === previous) index = (index + 1) % this.count;
    this.history.push(index);
    this.position = this.history.length - 1;
    return index;
  }

  start(index: number): number | null {
    if (index < 0 || index >= this.count) return this.next();
    this.history.push(index);
    this.position = this.history.length - 1;
    return index;
  }

  previous(): number | null {
    if (this.position <= 0) return null;
    this.position -= 1;
    return this.history[this.position];
  }
}

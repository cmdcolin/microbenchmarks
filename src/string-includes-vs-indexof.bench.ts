import { bench, describe } from 'vitest';

describe('string.includes() vs string.indexOf()', () => {
  const shortString = 'hello world';
  const mediumString = 'The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog.';
  const longString = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100);

  const searchTerm = 'fox';
  const notFoundTerm = 'xyz123';

  describe('short strings - found', () => {
    bench('includes()', () => {
      shortString.includes('world');
    }, { time: 1000 });

    bench('indexOf() !== -1', () => {
      shortString.indexOf('world') !== -1;
    }, { time: 1000 });
  });

  describe('short strings - not found', () => {
    bench('includes()', () => {
      shortString.includes(notFoundTerm);
    }, { time: 1000 });

    bench('indexOf() !== -1', () => {
      shortString.indexOf(notFoundTerm) !== -1;
    }, { time: 1000 });
  });

  describe('medium strings - found', () => {
    bench('includes()', () => {
      mediumString.includes(searchTerm);
    }, { time: 1000 });

    bench('indexOf() !== -1', () => {
      mediumString.indexOf(searchTerm) !== -1;
    }, { time: 1000 });
  });

  describe('medium strings - not found', () => {
    bench('includes()', () => {
      mediumString.includes(notFoundTerm);
    }, { time: 1000 });

    bench('indexOf() !== -1', () => {
      mediumString.indexOf(notFoundTerm) !== -1;
    }, { time: 1000 });
  });

  describe('long strings - found', () => {
    bench('includes()', () => {
      longString.includes('ipsum');
    }, { time: 1000 });

    bench('indexOf() !== -1', () => {
      longString.indexOf('ipsum') !== -1;
    }, { time: 1000 });
  });

  describe('long strings - not found', () => {
    bench('includes()', () => {
      longString.includes(notFoundTerm);
    }, { time: 1000 });

    bench('indexOf() !== -1', () => {
      longString.indexOf(notFoundTerm) !== -1;
    }, { time: 1000 });
  });
});

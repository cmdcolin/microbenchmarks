# js microbenchmarks

```
node src/pre_allocate_array.js
no pre-allocate x 587 ops/sec ±0.50% (93 runs sampled)
pre-allocate x 1,010 ops/sec ±1.28% (95 runs sampled)
pre-allocate and fill x 934 ops/sec ±0.47% (95 runs sampled)
new Array() constructor x 537 ops/sec ±0.40% (91 runs sampled)
Fastest is pre-allocate
```

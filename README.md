## dist/async_tight_loop.test.js
```
NANOBENCH version 2
> /home/cdiesh/.fnm/node-versions/v20.2.0/installation/bin/node dist/async_tight_loop.test.js

# async tight loop
ok ~1.56 s (1 s + 556574770 ns)

# non-async tight loop
ok ~46 ms (0 s + 45541867 ns)

all benchmarks completed
ok ~1.6 s (1 s + 602116637 ns)

```
## dist/frequency_table.test.js
```
NANOBENCH version 2
> /home/cdiesh/.fnm/node-versions/v20.2.0/installation/bin/node dist/frequency_table.test.js

# reduce+optional chaining
ok ~3.47 s (3 s + 470743215 ns)

# fromEntries+map->object+reduce
ok ~5.22 s (5 s + 224902154 ns)

# bit twiddle+object+reduce
ok ~4.24 s (4 s + 239836790 ns)

# reduce+map
ok ~5.14 s (5 s + 143754532 ns)

# for loop+obj+bit twiddle
ok ~3.27 s (3 s + 268974131 ns)

# for loop+map+bit twiddle
ok ~3.84 s (3 s + 837402211 ns)

all benchmarks completed
ok ~25 s (25 s + 185613033 ns)

```
## dist/obj_vs_map.test.js
```
NANOBENCH version 2
> /home/cdiesh/.fnm/node-versions/v20.2.0/installation/bin/node dist/obj_vs_map.test.js

# object.fromentries
ok ~7.8 s (7 s + 802406461 ns)

# new map
ok ~7.53 s (7 s + 533272586 ns)

all benchmarks completed
ok ~15 s (15 s + 335679047 ns)

```
## dist/pre_allocate_array.test.js
```
NANOBENCH version 2
> /home/cdiesh/.fnm/node-versions/v20.2.0/installation/bin/node dist/pre_allocate_array.test.js

# no pre-allocate
ok ~1.96 s (1 s + 956168252 ns)

# pre-allocate
ok ~1.1 s (1 s + 98236108 ns)

# pre-allocate and fill
ok ~1.19 s (1 s + 189720910 ns)

all benchmarks completed
ok ~4.24 s (4 s + 244125270 ns)

```
## dist/remove_newlines.test.js
```
NANOBENCH version 2
> /home/cdiesh/.fnm/node-versions/v20.2.0/installation/bin/node dist/remove_newlines.test.js

# replaceAll newline char
ok ~9.08 s (9 s + 76033004 ns)

# replaceAll newline regex
ok ~9.52 s (9 s + 524155996 ns)

# regex whitespace
ok ~9.4 s (9 s + 397826086 ns)

# regex newline
ok ~9.94 s (9 s + 935248062 ns)

all benchmarks completed
ok ~38 s (37 s + 933263148 ns)

```

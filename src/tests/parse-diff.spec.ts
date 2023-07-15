import { parseDiff } from '@/gitlab/parse-diff';

describe('parseDiff', () => {
  const diff1 = `@@ -9,7 +9,7 @@
 <span class="sr-only">Open sidebar</span>
 <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"
 aria-hidden="true">
- <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
+ <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>
 </svg>
 </button>
 
@@ -23,7 +23,7 @@
 fill="currentColor" aria-hidden="true">
 <path fill-rule="evenodd"
 d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
- clip-rule="evenodd" />
+ clip-rule="evenodd"/>
 </svg>
 <input id="search-field"
 class="block h-full w-full border-0 py-0 pl-8 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
 `;

  it('should return the correct line ranges for diff1', () => {
    const result = parseDiff(diff1);
    expect(result).toEqual([
      [12, 12],
      [26, 26],
    ]);
  });

  const diff2 = `@@ -1,5 +1,5 @@
-const foo = 'bar';
+const foo = 'baz';
 `;

  it('should return the correct line ranges for diff2', () => {
    const result = parseDiff(diff2);
    expect(result).toEqual([[1, 1]]);
  });

  const diff3 = `@@ -3,7 +3,7 @@
 <path fill-rule="evenodd"
 d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
- clip-rule="evenodd" />
+ clip-rule="evenodd"/>
 </svg>
 <input id="search-field"
 class="block h-full w-full border-0 py-0 pl-8 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
 `;

  it('should return the correct line ranges for diff3', () => {
    const result = parseDiff(diff3);
    expect(result).toEqual([[5, 5]]);
  });
});

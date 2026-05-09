'use strict';

// ─── Judge0 Language IDs ──────────────────────────────────────────────────────
const LANG_IDS = {
  c:          50,
  cpp:        54,
  java:       62,
  python:     71,
  javascript: 63,
  typescript: 74,
  go:         60,
  rust:       73,
  csharp:     51,
  php:        68,
  ruby:       72,
  kotlin:     78,
  swift:      83,
  bash:       46,
};

// ─── Judge0 public API call (wait=true for sync result) ──────────────────────
function callJudge0(sourceCode, languageId, stdin) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    // Normalize line endings to avoid \r causing compilation/runtime errors in Linux-based Judge0
    const normalizedCode = sourceCode.replace(/\r\n/g, '\n');
    const normalizedStdin = (stdin || '').replace(/\r\n/g, '\n');
    
    const body = JSON.stringify({ source_code: normalizedCode, language_id: languageId, stdin: normalizedStdin });
    const options = {
      hostname: 'ce.judge0.com',
      path: '/submissions?base64_encoded=false&wait=true',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Judge0 parse error: ' + data.slice(0, 100))); }
      });
    });
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('Judge0 timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function runWithJudge0(code, language, stdin) {
  const langId = LANG_IDS[language];
  if (!langId) return { stdout: null, stderr: 'Unsupported language', status: 'error' };
  try {
    const r = await callJudge0(code, langId, stdin);
    // status.id: 3=Accepted, 6=CompilationError, 7-14=RuntimeError
    const stderr = r.stderr || r.compile_output || '';
    const statusId = r.status?.id;
    if (statusId === 6) return { stdout: null, stderr: 'Compilation error:\n' + stderr, status: 'compile_error' };
    if (statusId === 5) return { stdout: null, stderr: 'Time Limit Exceeded', status: 'tle' };
    if (statusId >= 7)  return { stdout: null, stderr: stderr || 'Runtime error', status: 'runtime_error' };
    return { stdout: (r.stdout || '').trim(), stderr, status: 'ok' };
  } catch (e) {
    return { stdout: null, stderr: e.message, status: 'error' };
  }
}

// ─── Generic starter templates (for languages without a specific template) ────
function genericStarter(language) {
  const templates = {
    typescript: `// Read from stdin and write to stdout\nimport * as readline from 'readline';\nconst rl = readline.createInterface({ input: process.stdin });\nconst lines: string[] = [];\nrl.on('line', l => lines.push(l.trim()));\nrl.on('close', () => {\n  // Parse lines[], solve, console.log(answer)\n});`,
    go: `package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"os"\n)\n\nfunc main() {\n\treader := bufio.NewReader(os.Stdin)\n\t// Read input with fmt.Fscan(reader, &x)\n\t// fmt.Println(answer)\n\t_ = reader\n}`,
    rust: `use std::io::{self, BufRead};\n\nfn main() {\n    let stdin = io::stdin();\n    let mut lines = stdin.lock().lines();\n    // let line = lines.next().unwrap().unwrap();\n    // println!("{}", answer);\n    let _ = lines;\n}`,
    csharp: `using System;\nusing System.Linq;\n\nclass Program {\n    static void Main(string[] args) {\n        // string line = Console.ReadLine();\n        // Console.WriteLine(answer);\n    }\n}`,
    php: `<?php\n$lines = explode("\\n", trim(file_get_contents("php://stdin")));\n// parse $lines, echo answer\n?>`,
    ruby: `lines = $stdin.read.split("\\n")\n# parse lines, puts answer`,
    kotlin: `import java.util.Scanner\n\nfun main() {\n    val sc = Scanner(System.in)\n    // val n = sc.nextInt()\n    // println(answer)\n}`,
    swift: `import Foundation\nvar lines = readLine()!\n// parse, print(answer)`,
    bash: `#!/bin/bash\nread -r input\n# echo answer`,
  };
  return templates[language] || '// Write your solution here';
}

// ─── Coding Problems ──────────────────────────────────────────────────────────
const CODING_PROBLEMS = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    tags: ['Array', 'Hash Map'],
    description: 'Given an array of integers `nums` and an integer `target`, return **indices** of the two numbers that add up to target.\n\nYou may assume each input has exactly one solution, and you may not use the same element twice.',
    examples: [
      { input: 'nums = [2,7,11,15], target = 9', output: '0 1', explanation: 'nums[0] + nums[1] == 9' },
      { input: 'nums = [3,2,4], target = 6',     output: '1 2', explanation: 'nums[1] + nums[2] == 6' },
    ],
    constraints: ['2 ≤ nums.length ≤ 10⁴', '-10⁹ ≤ nums[i] ≤ 10⁹', 'Only one valid answer exists'],
    inputFormat: 'Line 1: n (array length)\nLine 2: n space-separated integers\nLine 3: target',
    outputFormat: 'Two space-separated indices i j',
    testCases: [
      { stdin: '4\n2 7 11 15\n9',   expected: '0 1' },
      { stdin: '3\n3 2 4\n6',       expected: '1 2' },
      { stdin: '2\n3 3\n6',         expected: '0 1' },
    ],
    hiddenTests: [
      { stdin: '4\n1 5 3 2\n4',     expected: '2 3' },
      { stdin: '5\n-1 -2 -3 -4 -5\n-8', expected: '2 4' },
    ],
    starterCode: {
      javascript: `process.stdin.resume();
process.stdin.setEncoding('utf8');
let _in = '';
process.stdin.on('data', d => _in += d);
process.stdin.on('end', () => {
  const lines = _in.trim().split('\\n');
  const n = parseInt(lines[0]);
  const nums = lines[1].split(' ').map(Number);
  const target = parseInt(lines[2]);
  console.log(twoSum(nums, target).join(' '));
});

function twoSum(nums, target) {
  // Your code here
}`,
      python: `import sys
data = sys.stdin.read().split()
n = int(data[0])
nums = list(map(int, data[1:n+1]))
target = int(data[n+1])

def twoSum(nums, target):
    # Your code here
    pass

print(*twoSum(nums, target))`,
      c: `#include <stdio.h>

void twoSum(int* nums, int n, int target, int* ri, int* rj) {
    /* Your code here */
    for (int i = 0; i < n; i++)
        for (int j = i+1; j < n; j++)
            if (nums[i]+nums[j]==target) { *ri=i; *rj=j; return; }
}

int main() {
    int n, target, nums[10000];
    scanf("%d", &n);
    for (int i=0;i<n;i++) scanf("%d",&nums[i]);
    scanf("%d",&target);
    int i=-1,j=-1;
    twoSum(nums,n,target,&i,&j);
    printf("%d %d\\n",i,j);
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    // Your code here
    return {};
}

int main() {
    int n, target; cin >> n;
    vector<int> nums(n);
    for (auto& x : nums) cin >> x;
    cin >> target;
    auto a = twoSum(nums, target);
    cout << a[0] << " " << a[1] << "\\n";
}`,
      java: `import java.util.*;

public class Main {
    static int[] twoSum(int[] nums, int target) {
        // Your code here
        return new int[]{};
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i=0;i<n;i++) nums[i]=sc.nextInt();
        int target = sc.nextInt();
        int[] a = twoSum(nums, target);
        System.out.println(a[0]+" "+a[1]);
    }
}`,
      go: `package main
import "fmt"

func twoSum(nums []int, target int) []int {
    // Your code here
    return nil
}

func main() {
    var n, target int
    fmt.Scan(&n)
    nums := make([]int, n)
    for i := range nums { fmt.Scan(&nums[i]) }
    fmt.Scan(&target)
    a := twoSum(nums, target)
    fmt.Println(a[0], a[1])
}`,
      rust: `use std::io::{self,Read};

fn two_sum(nums:&[i32], target:i32)->Vec<i32>{
    // Your code here
    vec![]
}

fn main(){
    let mut s=String::new();
    io::stdin().read_to_string(&mut s).unwrap();
    let mut it=s.split_whitespace();
    let n:usize=it.next().unwrap().parse().unwrap();
    let nums:Vec<i32>=(0..n).map(|_|it.next().unwrap().parse().unwrap()).collect();
    let target:i32=it.next().unwrap().parse().unwrap();
    let a=two_sum(&nums,target);
    println!("{} {}",a[0],a[1]);
}`,
      csharp: `using System;using System.Linq;
class Main{
    static int[] TwoSum(int[] nums,int target){
        // Your code here
        return new int[]{};
    }
    static void Main(string[] args){
        int n=int.Parse(Console.ReadLine());
        int[] nums=Console.ReadLine().Split().Select(int.Parse).ToArray();
        int target=int.Parse(Console.ReadLine());
        int[] a=TwoSum(nums,target);
        Console.WriteLine(a[0]+" "+a[1]);
    }
}`,
    },
  },

  {
    id: 'palindrome',
    title: 'Valid Palindrome',
    difficulty: 'Easy',
    tags: ['String', 'Two Pointers'],
    description: 'A phrase is a **palindrome** if, after converting to lowercase and removing non-alphanumeric characters, it reads the same forward and backward.\n\nGiven string `s`, return `true` if palindrome, `false` otherwise.',
    examples: [
      { input: 's = "A man, a plan, a canal: Panama"', output: 'true',  explanation: '"amanaplanacanalpanama" is a palindrome' },
      { input: 's = "race a car"',                     output: 'false', explanation: '"raceacar" is not' },
    ],
    constraints: ['1 ≤ s.length ≤ 2×10⁵'],
    inputFormat: 'Single line string s',
    outputFormat: 'true or false',
    testCases: [
      { stdin: 'A man, a plan, a canal: Panama', expected: 'true'  },
      { stdin: 'race a car',                     expected: 'false' },
      { stdin: ' ',                              expected: 'true'  },
    ],
    hiddenTests: [
      { stdin: 'Was it a car or a cat I saw?', expected: 'true'  },
      { stdin: 'hello',                        expected: 'false' },
    ],
    starterCode: {
      javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim();

function isPalindrome(s) {
  // Your code here
}

console.log(isPalindrome(lines).toString());`,
      python: `s = input()

def isPalindrome(s):
    # Your code here
    pass

print(str(isPalindrome(s)).lower())`,
      c: `#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <stdbool.h>

bool isPalindrome(char* s) {
    /* Your code here */
    return false;
}

int main() {
    char s[200005];
    fgets(s,sizeof(s),stdin);
    int len=strlen(s);
    if(s[len-1]=='\\n') s[len-1]=0;
    printf("%s\\n", isPalindrome(s)?"true":"false");
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

bool isPalindrome(string s) {
    // Your code here
    return false;
}

int main() {
    string s; getline(cin, s);
    cout << (isPalindrome(s) ? "true" : "false") << "\\n";
}`,
      java: `import java.util.*;

public class Main {
    static boolean isPalindrome(String s) {
        // Your code here
        return false;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.nextLine();
        System.out.println(isPalindrome(s));
    }
}`,
      go: `package main
import ("bufio";"fmt";"os")

func isPalindrome(s string) bool {
    // Your code here
    return false
}

func main() {
    r := bufio.NewReader(os.Stdin)
    s, _ := r.ReadString('\\n')
    if len(s)>0 && s[len(s)-1]=='\\n' { s=s[:len(s)-1] }
    if isPalindrome(s) { fmt.Println("true") } else { fmt.Println("false") }
}`,
      rust: `use std::io;
fn is_palindrome(s:&str)->bool{
    // Your code here
    false
}
fn main(){
    let mut s=String::new();
    io::stdin().read_line(&mut s).unwrap();
    let s=s.trim_end();
    println!("{}",is_palindrome(s));
}`,
      csharp: `using System;
class Main{
    static bool IsPalindrome(string s){
        // Your code here
        return false;
    }
    static void Main(){
        string s=Console.ReadLine();
        Console.WriteLine(IsPalindrome(s).ToString().ToLower());
    }
}`,
    },
  },

  {
    id: 'fizzbuzz',
    title: 'FizzBuzz',
    difficulty: 'Easy',
    tags: ['Math', 'String'],
    description: 'Given integer `n`, for each i from 1 to n print:\n- **FizzBuzz** if divisible by 3 and 5\n- **Fizz** if divisible by 3\n- **Buzz** if divisible by 5\n- **i** otherwise',
    examples: [
      { input: 'n = 5', output: '1\n2\nFizz\n4\nBuzz', explanation: '' },
    ],
    constraints: ['1 ≤ n ≤ 10⁴'],
    inputFormat: 'Single integer n',
    outputFormat: 'n lines',
    testCases: [
      { stdin: '5',  expected: '1\n2\nFizz\n4\nBuzz' },
      { stdin: '3',  expected: '1\n2\nFizz' },
      { stdin: '15', expected: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz' },
    ],
    hiddenTests: [
      { stdin: '1',  expected: '1' },
      { stdin: '6',  expected: '1\n2\nFizz\n4\nBuzz\nFizz' },
    ],
    starterCode: {
      javascript: `const n = parseInt(require('fs').readFileSync('/dev/stdin','utf8').trim());

function fizzBuzz(n) {
  // Your code here
}

fizzBuzz(n).forEach(x => console.log(x));`,
      python: `n = int(input())

def fizzBuzz(n):
    # Your code here
    pass

for x in fizzBuzz(n):
    print(x)`,
      c: `#include <stdio.h>

void fizzBuzz(int n) {
    /* Your code here */
}

int main() {
    int n; scanf("%d",&n);
    fizzBuzz(n);
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

void fizzBuzz(int n) {
    // Your code here
}

int main() {
    int n; cin>>n;
    fizzBuzz(n);
}`,
      java: `import java.util.*;

public class Main {
    static void fizzBuzz(int n) {
        // Your code here
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        fizzBuzz(sc.nextInt());
    }
}`,
      go: `package main
import "fmt"

func fizzBuzz(n int) {
    // Your code here
}

func main() {
    var n int; fmt.Scan(&n); fizzBuzz(n)
}`,
      rust: `use std::io;
fn fizz_buzz(n:u32){
    // Your code here
}
fn main(){
    let mut s=String::new();
    io::stdin().read_line(&mut s).unwrap();
    let n:u32=s.trim().parse().unwrap();
    fizz_buzz(n);
}`,
      csharp: `using System;
class Main{
    static void FizzBuzz(int n){
        // Your code here
    }
    static void Main(){
        FizzBuzz(int.Parse(Console.ReadLine()));
    }
}`,
    },
  },

  {
    id: 'max-subarray',
    title: 'Maximum Subarray',
    difficulty: 'Medium',
    tags: ['Array', 'DP', "Kadane's"],
    description: 'Given integer array `nums`, find the **subarray** with the largest sum and return its sum.',
    examples: [
      { input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6', explanation: '[4,-1,2,1] has sum 6' },
      { input: 'nums = [1]', output: '1', explanation: '' },
    ],
    constraints: ['1 ≤ nums.length ≤ 10⁵', '-10⁴ ≤ nums[i] ≤ 10⁴'],
    inputFormat: 'Line 1: n\nLine 2: n space-separated integers',
    outputFormat: 'Single integer',
    testCases: [
      { stdin: '9\n-2 1 -3 4 -1 2 1 -5 4', expected: '6'  },
      { stdin: '1\n1',                       expected: '1'  },
      { stdin: '5\n5 4 -1 7 8',              expected: '23' },
    ],
    hiddenTests: [
      { stdin: '1\n-1',    expected: '-1' },
      { stdin: '2\n-2 -1', expected: '-1' },
    ],
    starterCode: {
      javascript: `process.stdin.resume();
process.stdin.setEncoding('utf8');
let _in='';
process.stdin.on('data',d=>_in+=d);
process.stdin.on('end',()=>{
  const lines=_in.trim().split('\\n');
  const nums=lines[1].split(' ').map(Number);
  console.log(maxSubArray(nums));
});

function maxSubArray(nums) {
  // Your code here
}`,
      python: `import sys
data=sys.stdin.read().split()
n=int(data[0])
nums=list(map(int,data[1:n+1]))

def maxSubArray(nums):
    # Your code here
    pass

print(maxSubArray(nums))`,
      c: `#include <stdio.h>

int maxSubArray(int* nums, int n) {
    /* Your code here */
    return 0;
}

int main() {
    int n; scanf("%d",&n);
    int nums[100000];
    for(int i=0;i<n;i++) scanf("%d",&nums[i]);
    printf("%d\\n",maxSubArray(nums,n));
}`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

int maxSubArray(vector<int>& nums) {
    // Your code here
    return 0;
}

int main() {
    int n; cin>>n;
    vector<int> nums(n);
    for(auto& x:nums) cin>>x;
    cout<<maxSubArray(nums)<<"\\n";
}`,
      java: `import java.util.*;

public class Main {
    static int maxSubArray(int[] nums) {
        // Your code here
        return 0;
    }

    public static void main(String[] args) {
        Scanner sc=new Scanner(System.in);
        int n=sc.nextInt();
        int[] nums=new int[n];
        for(int i=0;i<n;i++) nums[i]=sc.nextInt();
        System.out.println(maxSubArray(nums));
    }
}`,
      go: `package main
import "fmt"

func maxSubArray(nums []int) int {
    // Your code here
    return 0
}

func main() {
    var n int; fmt.Scan(&n)
    nums:=make([]int,n)
    for i:=range nums{fmt.Scan(&nums[i])}
    fmt.Println(maxSubArray(nums))
}`,
      rust: `use std::io::{self,Read};
fn max_sub_array(nums:&[i32])->i32{
    // Your code here
    0
}
fn main(){
    let mut s=String::new();
    io::stdin().read_to_string(&mut s).unwrap();
    let mut it=s.split_whitespace();
    let n:usize=it.next().unwrap().parse().unwrap();
    let nums:Vec<i32>=(0..n).map(|_|it.next().unwrap().parse().unwrap()).collect();
    println!("{}",max_sub_array(&nums));
}`,
      csharp: `using System;
class Main{
    static int MaxSubArray(int[] nums){
        // Your code here
        return 0;
    }
    static void Main(){
        int n=int.Parse(Console.ReadLine());
        var nums=Array.ConvertAll(Console.ReadLine().Split(),int.Parse);
        Console.WriteLine(MaxSubArray(nums));
    }
}`,
    },
  },

  {
    id: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    difficulty: 'Hard',
    tags: ['Array', 'Two Pointers', 'Stack'],
    description: 'Given `n` non-negative integers representing an elevation map where the width of each bar is `1`, compute how much water it can trap after raining.',
    examples: [
      { input: 'height = [0,1,0,2,1,0,1,3,2,1,2,1]', output: '6', explanation: '6 units of rain water are being trapped.' }
    ],
    constraints: ['n == height.length', '1 ≤ n ≤ 2 * 10⁴', '0 ≤ height[i] ≤ 10⁵'],
    inputFormat: 'Line 1: n\nLine 2: n space-separated integers',
    outputFormat: 'Single integer',
    testCases: [
      { stdin: '12\n0 1 0 2 1 0 1 3 2 1 2 1', expected: '6' },
      { stdin: '6\n4 2 0 3 2 5', expected: '9' }
    ],
    hiddenTests: [
      { stdin: '1\n100', expected: '0' },
      { stdin: '3\n2 0 2', expected: '2' }
    ],
    starterCode: {
      javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nif(lines.length>1){\n  const height = lines[1].split(' ').map(Number);\n  console.log(trap(height));\n}\n\nfunction trap(height) {\n  // Your code here\n}`,
      python: `import sys\ndata = sys.stdin.read().split()\nif len(data) > 0:\n    height = list(map(int, data[1:]))\n    def trap(height):\n        # Your code here\n        pass\n    print(trap(height))`,
      cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint trap(vector<int>& height) {\n    // Your code here\n    return 0;\n}\n\nint main() {\n    int n; if(cin >> n) {\n        vector<int> h(n);\n        for(int& x: h) cin >> x;\n        cout << trap(h) << "\\n";\n    }\n}`,
      java: `import java.util.*;\npublic class Main {\n    static int trap(int[] height) {\n        // Your code here\n        return 0;\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if(sc.hasNextInt()) {\n            int n = sc.nextInt();\n            int[] h = new int[n];\n            for(int i=0; i<n; i++) h[i] = sc.nextInt();\n            System.out.println(trap(h));\n        }\n    }\n}`
    }
  },

  {
    id: 'longest-increasing-subsequence',
    title: 'Longest Increasing Subsequence',
    difficulty: 'Medium',
    tags: ['Dynamic Programming', 'Binary Search'],
    description: 'Given an integer array `nums`, return the length of the longest strictly increasing subsequence.',
    examples: [
      { input: 'nums = [10,9,2,5,3,7,101,18]', output: '4', explanation: 'The longest increasing subsequence is [2,3,7,101], therefore the length is 4.' }
    ],
    constraints: ['1 ≤ nums.length ≤ 2500', '-10⁴ ≤ nums[i] ≤ 10⁴'],
    inputFormat: 'Line 1: n\nLine 2: n space-separated integers',
    outputFormat: 'Single integer',
    testCases: [
      { stdin: '8\n10 9 2 5 3 7 101 18', expected: '4' },
      { stdin: '6\n0 1 0 3 2 3', expected: '4' },
      { stdin: '1\n7', expected: '1' },
    ],
    hiddenTests: [
      { stdin: '5\n7 7 7 7 7', expected: '1' },
      { stdin: '9\n1 3 6 7 9 4 10 5 6', expected: '6' }
    ],
    starterCode: {
      javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nif(lines.length>1){\n  const nums = lines[1].split(' ').map(Number);\n  console.log(lengthOfLIS(nums));\n}\n\nfunction lengthOfLIS(nums) {\n  // Your code here\n}`,
      python: `import sys\ndata = sys.stdin.read().split()\nif len(data) > 0:\n    nums = list(map(int, data[1:]))\n    def lengthOfLIS(nums):\n        # Your code here\n        pass\n    print(lengthOfLIS(nums))`,
      cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint lengthOfLIS(vector<int>& nums) {\n    // Your code here\n    return 0;\n}\n\nint main() {\n    int n; if(cin >> n) {\n        vector<int> nums(n);\n        for(int& x: nums) cin >> x;\n        cout << lengthOfLIS(nums) << "\\n";\n    }\n}`,
      java: `import java.util.*;\npublic class Main {\n    static int lengthOfLIS(int[] nums) {\n        // Your code here\n        return 0;\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if(sc.hasNextInt()) {\n            int n = sc.nextInt();\n            int[] nums = new int[n];\n            for(int i=0; i<n; i++) nums[i] = sc.nextInt();\n            System.out.println(lengthOfLIS(nums));\n        }\n    }\n}`
    }
  },

  {
    id: 'number-of-islands',
    title: 'Number of Islands',
    difficulty: 'Medium',
    tags: ['Graph', 'DFS', 'BFS', 'Matrix'],
    description: 'Given an `m x n` 2D binary grid `grid` which represents a map of `1`s (land) and `0`s (water), return the number of islands.\n\nAn island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically.',
    examples: [
      { input: 'grid = [\n  ["1","1","1","1","0"],\n  ["1","1","0","1","0"],\n  ["1","1","0","0","0"],\n  ["0","0","0","0","0"]\n]', output: '1', explanation: '' }
    ],
    constraints: ['m == grid.length', 'n == grid[i].length', '1 ≤ m, n ≤ 300', 'grid[i][j] is "0" or "1"'],
    inputFormat: 'Line 1: m n (rows and columns)\nNext m lines: A string of length n containing 0s and 1s',
    outputFormat: 'Single integer',
    testCases: [
      { stdin: '4 5\n11110\n11010\n11000\n00000', expected: '1' },
      { stdin: '4 5\n11000\n11000\n00100\n00011', expected: '3' }
    ],
    hiddenTests: [
      { stdin: '1 1\n1', expected: '1' },
      { stdin: '3 3\n101\n010\n101', expected: '5' }
    ],
    starterCode: {
      javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nif(lines.length>0){\n  const [m, n] = lines[0].split(' ').map(Number);\n  const grid = lines.slice(1, m+1).map(line => line.split(''));\n  console.log(numIslands(grid));\n}\n\nfunction numIslands(grid) {\n  // Your code here\n}`,
      python: `import sys\nlines = sys.stdin.read().splitlines()\nif len(lines) > 0:\n    m, n = map(int, lines[0].split())\n    grid = [list(line) for line in lines[1:m+1]]\n    def numIslands(grid):\n        # Your code here\n        pass\n    print(numIslands(grid))`,
      cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint numIslands(vector<vector<char>>& grid) {\n    // Your code here\n    return 0;\n}\n\nint main() {\n    int m, n; if(cin >> m >> n) {\n        vector<vector<char>> grid(m, vector<char>(n));\n        for(int i=0; i<m; i++) {\n            string s; cin >> s;\n            for(int j=0; j<n; j++) grid[i][j] = s[j];\n        }\n        cout << numIslands(grid) << "\\n";\n    }\n}`,
      java: `import java.util.*;\npublic class Main {\n    static int numIslands(char[][] grid) {\n        // Your code here\n        return 0;\n    }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if(sc.hasNextInt()) {\n            int m = sc.nextInt();\n            int n = sc.nextInt();\n            char[][] grid = new char[m][n];\n            for(int i=0; i<m; i++) {\n                String s = sc.next();\n                grid[i] = s.toCharArray();\n            }\n            System.out.println(numIslands(grid));\n        }\n    }\n}`
    }
  },

];

function getStarterCode(problem, language) {
  return problem.starterCode?.[language] || genericStarter(language);
}

module.exports = { CODING_PROBLEMS, LANG_IDS, runWithJudge0, getStarterCode };

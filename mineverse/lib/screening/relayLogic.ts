export const RELAY_WORDS = [
  "Redstone",
  "Enderman",
  "Netherrack",
  "Netherite",
  "Mooshroom",
  "Spleef",
  "Herobrine",
  "Griefing",
  "Elytra",
  "Creeper",
  "Bedrock"
];

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

export function calculateCombinatorics(word: string): number {
  const lowerWord = word.toLowerCase();
  const vowelsSet = new Set(['a', 'e', 'i', 'o', 'u']);
  
  const vowels: string[] = [];
  const consonants: string[] = [];
  
  for (const char of lowerWord) {
    if (vowelsSet.has(char)) {
      vowels.push(char);
    } else {
      consonants.push(char);
    }
  }
  
  const totalEntities = consonants.length + 1;
  
  const entitiesCounter: Record<string, number> = {};
  for (const char of consonants) {
    entitiesCounter[char] = (entitiesCounter[char] || 0) + 1;
  }
  
  let entitiesArrangements = factorial(totalEntities);
  for (const count of Object.values(entitiesCounter)) {
    entitiesArrangements /= factorial(count);
  }
  
  const vowelsCounter: Record<string, number> = {};
  for (const char of vowels) {
    vowelsCounter[char] = (vowelsCounter[char] || 0) + 1;
  }
  
  let vowelsArrangements = factorial(vowels.length);
  for (const count of Object.values(vowelsCounter)) {
    vowelsArrangements /= factorial(count);
  }
  
  return entitiesArrangements * vowelsArrangements;
}

export function generateCodeSnippets(word: string, targetAnswer: number): Record<string, string> {
  const possibleCombinations: Array<[number, number, number, number]> = [];
  
  for (let S = 1; S <= 5; S++) {
    const multiplier = Math.pow(2, S);
    if (targetAnswer % multiplier === 0) {
      const remainder = targetAnswer / multiplier;
      for (let C = 1; C <= remainder; C++) {
        if (remainder % C === 0) {
          const sumDE = remainder / C;
          if (sumDE >= 2) {
            const D = Math.floor(sumDE / 2);
            const E = sumDE - D;
            possibleCombinations.push([S, C, D, E]);
          }
        }
      }
    }
  }
  
  if (possibleCombinations.length === 0) {
    const S = 0;
    const C = 1;
    const D = Math.floor(targetAnswer / 2);
    const E = targetAnswer - D;
    possibleCombinations.push([S, C, D, E]);
  }
  
  const [S, C, D, E] = possibleCombinations[Math.floor(Math.random() * possibleCombinations.length)];
  
  const val0 = Math.floor(Math.random() * 100) + 1;
  const val1 = Math.floor(Math.random() * 100) + 1;
  const val5 = Math.floor(Math.random() * 100) + 1;
  
  const teamName = word.charAt(0).toUpperCase() + word.slice(1);
  
  const cppCode = `// For Team: ${teamName}
#include <iostream>
using namespace std;

int main() {
    // Array of block IDs stored in chunk memory
    int chunk_data[] = {${val0}, ${val1}, ${C}, ${D}, ${E}, ${val5}}; 
    int *steve_pos = chunk_data;
    steve_pos = steve_pos + 2;
    int redstone_signal = ${S};
    
    int final_power = (*steve_pos << redstone_signal) * (*(steve_pos + 1) + *(steve_pos + 2));
    
    cout << final_power;
    return 0;
}`;

  const cCode = `// For Team: ${teamName}
#include <stdio.h>

int main() {
    // Array of block IDs stored in chunk memory
    int chunk_data[] = {${val0}, ${val1}, ${C}, ${D}, ${E}, ${val5}}; 
    int *steve_pos = chunk_data;
    steve_pos = steve_pos + 2;
    int redstone_signal = ${S};
    
    int final_power = (*steve_pos << redstone_signal) * (*(steve_pos + 1) + *(steve_pos + 2));
    
    printf("%d", final_power);
    return 0;
}`;

  const javaCode = `// For Team: ${teamName}
public class Main {
    public static void main(String[] args) {
        // Array of block IDs stored in chunk memory
        int[] chunk_data = {${val0}, ${val1}, ${C}, ${D}, ${E}, ${val5}}; 
        int steve_pos_idx = 2;
        int redstone_signal = ${S};
        
        int final_power = (chunk_data[steve_pos_idx] << redstone_signal) * 
                          (chunk_data[steve_pos_idx + 1] + chunk_data[steve_pos_idx + 2]);
        
        System.out.println(final_power);
    }
}`;

  const pythonCode = `# For Team: ${teamName}
def main():
    # Array of block IDs stored in chunk memory
    chunk_data = [${val0}, ${val1}, ${C}, ${D}, ${E}, ${val5}]
    steve_pos_idx = 2
    redstone_signal = ${S}
    
    final_power = (chunk_data[steve_pos_idx] << redstone_signal) * \\
                  (chunk_data[steve_pos_idx + 1] + chunk_data[steve_pos_idx + 2])
    
    print(final_power)

if __name__ == "__main__":
    main()`;

  const jsCode = `// For Team: ${teamName}
function main() {
    // Array of block IDs stored in chunk memory
    const chunk_data = [${val0}, ${val1}, ${C}, ${D}, ${E}, ${val5}]; 
    const steve_pos_idx = 2;
    const redstone_signal = ${S};
    
    const final_power = (chunk_data[steve_pos_idx] << redstone_signal) * 
                        (chunk_data[steve_pos_idx + 1] + chunk_data[steve_pos_idx + 2]);
    
    console.log(final_power);
}

main();`;

  return {
    "Python": pythonCode,
    "C": cCode,
    "C++": cppCode,
    "Java": javaCode,
    "JS": jsCode
  };
}

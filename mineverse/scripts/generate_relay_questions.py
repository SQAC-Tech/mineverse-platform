import random
import math
from collections import Counter

# Words list provided for the 1st year combinatorics question
words = [
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
]

def calculate_combinatorics(word):
    """
    Calculates the number of ways to arrange the letters of the word
    such that all vowels are clustered in a single unbroken block.
    """
    word = word.lower()
    vowels_set = {'a', 'e', 'i', 'o', 'u'}
    
    vowels = [char for char in word if char in vowels_set]
    consonants = [char for char in word if char not in vowels_set]
    
    # Total entities = number of consonants + 1 block of vowels
    total_entities = len(consonants) + 1
    
    # Arrangements of entities (consonants + vowel block)
    entities_counter = Counter(consonants)
    entities_arrangements = math.factorial(total_entities)
    for count in entities_counter.values():
        entities_arrangements //= math.factorial(count)
        
    # Arrangements of vowels within the vowel block
    vowels_counter = Counter(vowels)
    vowels_arrangements = math.factorial(len(vowels))
    for count in vowels_counter.values():
        vowels_arrangements //= math.factorial(count)
        
    return entities_arrangements * vowels_arrangements

def generate_cpp_code(word, target_answer):
    """
    Generates the 2nd year C++ code that outputs the target_answer.
    Formula: final_power = (C << S) * (D + E)
    Which is: (C * 2^S) * (D + E)
    """
    # Find suitable S, C, D, E such that (C * (2**S)) * (D + E) == target_answer
    # We iterate over possible S values (1 to 5) to see if target_answer is divisible by 2**S
    # And then factor the remainder into C and (D+E)
    
    possible_combinations = []
    
    for S in range(1, 6):
        multiplier = 2**S
        if target_answer % multiplier == 0:
            remainder = target_answer // multiplier
            # Now we need C * sum_DE = remainder
            # Let's find factors for remainder
            for C in range(1, remainder + 1):
                if remainder % C == 0:
                    sum_DE = remainder // C
                    if sum_DE >= 2: # So D and E can be at least 1
                        # Split sum_DE into D and E
                        D = sum_DE // 2
                        E = sum_DE - D
                        possible_combinations.append((S, C, D, E))
    
    if not possible_combinations:
        # Fallback if no exact bitwise shift matches nicely
        S = 0
        C = 1
        D = target_answer // 2
        E = target_answer - D
        possible_combinations.append((S, C, D, E))
        
    # Pick a random valid combination to add variety
    S, C, D, E = random.choice(possible_combinations)
    
    # Generate random dummy values for the array
    # Array indices: 0, 1, 2(C), 3(D), 4(E), 5
    val0 = random.randint(1, 100)
    val1 = random.randint(1, 100)
    val5 = random.randint(1, 100)
    
    cpp_code = f"""// For Team: {word.capitalize()}
#include <iostream>
using namespace std;

int main() {{
    // Array of block IDs stored in chunk memory
    int chunk_data[] = {{{val0}, {val1}, {C}, {D}, {E}, {val5}}}; 
    int *steve_pos = chunk_data;
    steve_pos = steve_pos + 2;
    int redstone_signal = {S};
    
    int final_power = (*steve_pos << redstone_signal) * (*(steve_pos + 1) + *(steve_pos + 2));
    
    cout << final_power;
    return 0;
}}
"""
    return cpp_code

def main():
    print("# Hackathon Relay Round Questions")
    print("This document contains the linked questions for all 11 teams.\\n")
    
    for word in words:
        ans = calculate_combinatorics(word)
        cpp_code = generate_cpp_code(word, ans)
        
        print(f"## Team Word: **{word.upper()}**")
        print(f"### 1st Year Question")
        print(f"The Server Admins are hosting an elite HACKATHON and have secured the main arena with a combination lock. The 4-digit PIN is exactly the number of unique ways you can arrange the letters of the word **{word.upper()}** such that all the vowels always remain clustered together in a single unbroken block. What is the 4-digit PIN to open the iron doors?")
        print(f"**Answer**: {ans}\\n")
        
        print(f"### 2nd Year Question")
        print(f"A corrupted chunk's memory is throwing a critical error. Determine the exact integer output of the following C++ execution to stabilize the chunk. This output is your half of the server PIN.")
        print("```cpp")
        print(cpp_code.strip())
        print("```")
        print(f"**Expected Output**: {ans}")
        print("---")

if __name__ == "__main__":
    main()

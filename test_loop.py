import os

with open('/tmp/App.tsx', 'r') as f:
    lines = f.readlines()

skip = False
for i, line in enumerate(lines):
    if "const handleAnalyze = async () => {" in line:
        skip = True
        print(f"Skipping handleAnalyze at line {i+1}")
    if skip and "};\n" in line and "    }\n" in lines[i-1] and "setIsLoading(false);\n" in lines[i-2]:
        skip = False
        print(f"Stopped skipping handleAnalyze at line {i+1}")


import os

with open('/tmp/App.tsx', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "};" in line and "setIsLoading(false);" in lines[i-2]:
        print(f"MATCH AT LINE {i+1}")
        print(repr(line))
        print(repr(lines[i-1]))
        print(repr(lines[i-2]))


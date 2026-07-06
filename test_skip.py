import os

with open('/tmp/App.tsx', 'r') as f:
    lines = f.readlines()

skip = False
for i, line in enumerate(lines):
    old_skip = skip
    # (Insert all conditions from my script, but print when skip changes)
    if "const [activeRecord, setActiveRecord] = useState" in line or "const activeRecord = useMemo" in line:
        skip = True
    if skip and "}, [selectedDate, records]);" in line:
        skip = False

    if "const isCurrentStepValid = useMemo(() => {" in line:
        skip = True
    if skip and "}, [step, birthDateMasehi, context, laborDate, experience, startTime, stopTime, records]);" in line:
        skip = False
    
    if "const handleAnalyze = async () => {" in line:
        skip = True
    if skip and "};" in line and "    }" in lines[i-1] and "setIsLoading(false);" in lines[i-2]:
        skip = False

    if "const allSteps = [" in line:
        skip = True
    if skip and "];" in line and "Hasil Analisis" in lines[i-1]:
        skip = False

    if "const steps = allSteps.filter(s => {" in line:
        skip = True
    if skip and "});" in line and "return true;" in lines[i-1]:
        skip = False

    if 'if (step === 1) return renderHalamanWrapper(' in line:
        skip = True
    if skip and 'if (step === 5) return renderHalamanWrapper(' in line:
        skip = False
    
    if "const renderStep5Redesign = () => {" in line:
        skip = True
    if skip and "const renderStep3 = () => {" in line:
        skip = True 
    if skip and "const renderStep4Redesign = () => (" in line:
        skip = True
    if skip and "const renderResult = () => (" in line:
        skip = False

    if old_skip != skip:
        if skip:
            print(f"[{i+1}] START SKIP: {line.strip()}")
        else:
            print(f"[{i+1}] STOP SKIP: {line.strip()}")

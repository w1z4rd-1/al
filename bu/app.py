import os
import time
import asyncio
import pvporcupine
import pyaudio
import wave
import speech_recognition as sr
from pvrecorder import PvRecorder
from langchain_openai import ChatOpenAI
from browser_use import Agent

# ==============================
# 🔹 CONFIGURATION
# ==============================

ACCESS_KEY = "8/P39p9rRTTjHIHY49yYs76jv8hy5IXH7NDJpheYfSMSSau2E+TFHw=="  # Hardcoded Picovoice Access Key
JARVIS_WAKE_WORD_PATH = "C:\\Users\\Terac\\ALFRED\\Jarvis.ppn"  # Path to wake word model file

# Audio settings
SAMPLE_RATE = 16000
FRAME_LENGTH = 512
SILENCE_THRESHOLD = 500  # Adjust this if needed
SILENCE_TIMEOUT = 2  # Stop recording after 2 seconds of silence
TEMP_AUDIO_FILE = "temp_audio.wav"  # Temporary file for Whisper STT


# ==============================
# 🔹 LISTEN FOR WAKE WORD
# ==============================

def listen_for_wake_word():
    """
    Uses Porcupine to listen for the wake word ("Jarvis").
    When detected, it returns True.
    """
    print("\nListening for wake word: Jarvis... (or type your prompt below)")

    porcupine = pvporcupine.create(access_key=ACCESS_KEY, keyword_paths=[JARVIS_WAKE_WORD_PATH])
    recorder = PvRecorder(device_index=-1, frame_length=porcupine.frame_length)
    recorder.start()

    try:
        while True:
            # Check for text input simultaneously
            if is_text_input_available():
                return "TEXT_MODE"

            audio_frame = recorder.read()
            result = porcupine.process(audio_frame)

            if result >= 0:
                print("Wake word detected! Starting transcription...")
                return "VOICE_MODE"
    except KeyboardInterrupt:
        print("\nStopping wake word detection.")
    finally:
        recorder.stop()
        porcupine.delete()


# ==============================
# 🔹 CHECK IF USER WANTS TO TYPE INSTEAD
# ==============================

def is_text_input_available():
    """
    Checks if the user wants to type instead of speaking.
    Press ENTER to enter manual text mode.
    """
    try:
        user_input = input("Press ENTER to type your prompt (or say 'Jarvis' to speak): ")
        if user_input.strip() == "":
            return True
    except KeyboardInterrupt:
        pass
    return False


# ==============================
# 🔹 RECORD UNTIL SILENCE
# ==============================

def record_until_silence():
    """
    Records audio until silence is detected for 2 seconds.
    Saves it as a WAV file for Whisper to process.
    """
    print("Listening... Speak now.")

    p = pyaudio.PyAudio()
    stream = p.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=SAMPLE_RATE,
        input=True,
        frames_per_buffer=FRAME_LENGTH
    )

    frames = []
    silent_frames = 0

    try:
        while True:
            audio_data = stream.read(FRAME_LENGTH, exception_on_overflow=False)
            frames.append(audio_data)

            # Convert bytes to integer for volume check
            volume = max(audio_data)
            if volume < SILENCE_THRESHOLD:
                silent_frames += 1
            else:
                silent_frames = 0  # Reset if speech detected

            # Stop if silence persists for 2 seconds
            if silent_frames > (SAMPLE_RATE // FRAME_LENGTH) * SILENCE_TIMEOUT:
                print("Silence detected. Stopping recording.")
                break
    except KeyboardInterrupt:
        print("\nStopped manually.")
    finally:
        stream.stop_stream()
        stream.close()
        p.terminate()

    # Save the recorded audio to a WAV file for transcription
    with wave.open(TEMP_AUDIO_FILE, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(p.get_sample_size(pyaudio.paInt16))
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(b''.join(frames))

    return TEMP_AUDIO_FILE


# ==============================
# 🔹 TRANSCRIBE AUDIO
# ==============================

def transcribe_audio(audio_path):
    """
    Transcribes the recorded audio file using Whisper.
    """
    recognizer = sr.Recognizer()
    with sr.AudioFile(audio_path) as source:
        audio_data = recognizer.record(source)

    print("Transcribing audio...")
    try:
        transcript = recognizer.recognize_whisper(audio_data)  # Whisper STT
        print("\n=== Transcription ===")
        print(transcript)
        return transcript
    except sr.UnknownValueError:
        print("Sorry, could not understand the audio.")
        return None
    except sr.RequestError:
        print("Whisper is unavailable.")
        return None


# ==============================
# 🔹 MAIN AI PROCESSING FUNCTION
# ==============================

async def run_agent(task: str):
    """
    Runs the AI agent using OpenAI and Browser-Agent.
    """
    print(f"\n-- Processing Task --  (task: {task})")
    llm = ChatOpenAI(model='gpt-4o-mini-2024-07-18')
    agent = Agent(task=task, llm=llm)
    await agent.run(max_steps=10)
    print("Agent completed!\n")


# ==============================
# 🔹 MAIN LOGIC: CHOOSE VOICE OR TEXT INPUT
# ==============================

async def main():
    """
    Main loop: allows user to enter input via wake word (speech) or typing (text).
    Passes the transcribed or typed input to the AI agent.
    """
    while True:
        input_mode = listen_for_wake_word()

        if input_mode == "TEXT_MODE":
            # User wants to type instead
            task = input("\nType your prompt: ")
        else:
            # User is using voice
            audio_file = record_until_silence()
            task = transcribe_audio(audio_file)

        if task:
            # Process AI response
            print(f"\nYou said: {task}")
            await run_agent(task)

        # Ensure the program **waits** for response before looping again
        print("\nReady for next command...\n")


# ==============================
# 🔹 RUN SCRIPT
# ==============================

if __name__ == "__main__":
    asyncio.run(main())

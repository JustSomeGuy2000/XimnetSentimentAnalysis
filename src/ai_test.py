import transformers as tf
import accelerate as accel

device = accel.Accelerator().device

pipeline = tf.pipeline("text-classification", device=device)

print(pipeline(["I love you.", "I hate you.", "I've sent you a message.", "I am neutral."]))
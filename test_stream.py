import time
from agent import create_agent
from langchain_core.messages import SystemMessage, HumanMessage

def test():
    agent_executor = create_agent()
    state = {
        "messages": [
            HumanMessage(content="What is 2+2? Tell me directly and step by step.")
        ]
    }
    
    print("Testing stream")
    for chunk in agent_executor.stream(state):
        print("Chunk keys:", chunk.keys())
        time.sleep(1)
        
test()

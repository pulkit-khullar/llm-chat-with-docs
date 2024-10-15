# LLM Chat with Docs

## Project Aim
This project aims to create a chatbot capable of querying documents using Large Language Models (LLMs) and document-based data retrieval. The chatbot enhances interactions by fetching relevant information from uploaded documents and generating responses based on this content.

## Tech Stack
- **Frontend**: React.js with TypeScript
- **Backend**: Node.js with TypeScript
- **Database**: ChromaDB for document retrieval and vector storage
- **Containerization**: Docker and Docker Compose
- **LLM**: LangChain for chain-based querying and retrieval-augmented generation (RAG)

## Features
- Real-time chatbot for querying documents.
- Retrieval-Augmented Generation (RAG) implementation using LangChain.
- Docker-based containerized environment for deployment.
- Integration with ChromaDB for efficient vector storage.

## Build and Run

### Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/pulkit-khullar/llm-chat-with-docs.git
   cd llm-chat-with-docs
   ```

2. **Install dependencies**:
   - For whole project:
     ```bash
     yarn run install:deps
     ```

3. **Environment Configuration**:
   - Copy `.env.example` to `.env` and fill in the required configuration values for both frontend and backend.

4. **Start the project**:
   - Dev:
     ```bash
     yarn run clean:build && yarn run dev
     ```
   - Prod:
     ```bash
     yarn run clean:build && yarn run start
     ```

### Docker Setup

1. **Build and run containers**:
   ```bash
   docker-compose up --build
   ```
   This will build and start application and chromadb.

2. **Access the application**:
   - `http://localhost:3001`

### Project Structure

- **frontend/**: Contains the React app built using TypeScript.
- **src/**: Node.js backend with TypeScript, serving as the API layer and handling document retrieval.
- **docker-compose.yml**: Defines the Docker services for both frontend and backend.

## Containerization
The project is containerized using Docker. Each service (chromadb and backend) runs in its own container, and the setup is orchestrated using `docker-compose`. This ensures an isolated and consistent environment across different setups.

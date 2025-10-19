# GEMINI.md

## Project Overview

**nooblyjs-core** is a modular Node.js backend framework that provides a comprehensive suite of core services for building scalable, event-driven applications. It is built with a service registry architecture, allowing for pluggable providers for each service. The project is designed for extensibility and rapid prototyping, making it suitable for microservices, serverless functions, and traditional server applications.

The core of the framework is the `ServiceRegistry`, which manages and provides singleton instances of various services, including:
- AI Service (`aiservice`)
- Authentication Service (`authservice`)
- Caching (`caching`)
- Data Service (`dataservice`)
- Filing (`filing`)
- Logging (`logging`)
- Measuring (`measuring`)
- Notifying (`notifying`)
- Queueing (`queueing`)
- Scheduling (`scheduling`)
- Searching (`searching`)
- Workflow (`workflow`)
- Working (`working`)

It uses a dependency injection system to manage dependencies between services, ensuring that services are initialized in the correct order.

**Key Technologies:**

*   **Backend:** Node.js, Express
*   **Services & Drivers:**
    *   **Caching:** Redis, Memcached
    *   **Data Serving:** MongoDB
    *   **Filing:** AWS S3, Google Cloud Storage, FTP
    *   **AI:** OpenAI, Anthropic, Gemini
    *   **Authentication:** Passport.js (Google OAuth, Local)
*   **Testing:** Jest for unit tests.

## Building and Running

### Installation

To install the project dependencies, run:

```bash
npm install
```

### Running the Application

To run the application in development mode, use the following command. This will start the server and watch for changes.

```bash
npm run dev:web
```

The application will be available at `http://localhost:3001`.

### Running Tests

The project includes both unit and load tests.

*   **Unit Tests:** To run the unit tests, use:

    ```bash
    npm test
    ```

*   **Load Tests:** To run the load tests, use:

    ```bash
    npm run test-load
    ```

## Development Conventions

### Coding Style

The project uses Prettier for code formatting, as defined in the `.prettierrc` file. It also uses JSDoc for inline documentation.

### Service Architecture

The framework is built around a service registry pattern. New services can be added by creating a new service factory in the `src` directory. Each service can have multiple providers, allowing for different implementations to be swapped in as needed.

### API

The project exposes a set of RESTful APIs for each service. These APIs are defined in the `README.md` file and are implemented in the respective service modules.
# CS425-NetworkGameShow

## Branch Strategy

We use a multi-branch model for safe collaboration:

### main
- Production-ready branch.
- Only merged into through Pull Requests from `dev`.
- Always stable and demo-ready.

### dev
- Integration branch for ongoing work.
- All feature branches merge here first.
- After testing and review, dev is merged into main.

### Individual Branches
Each team member has a personal permanent branch:
- jeremiahrobinson842

Work is done in short-lived feature branches based on these personal branches, for example:
- jeremiahrobinson842/feature-socket-lobby

### Workflow
1. Developer creates feature branch from their personal branch.
2. They push commits and open a Pull Request into `dev`.
3. After team review & testing, `dev` is merged into `main`.

This model minimizes merge conflicts, keeps `main` stable, and organizes ownership clearly.

### Continuous Integration (CI)
The project includes a GitHub Actions workflow (.github/workflows/ci.yml) that runs automatically on new commits and pull requests.

### CI Tasks
The pipeline performs:
- Backend dependency installation
- Backend syntax validation
- Backend start-up check (to ensure no missing files)
- Client dependency installation
- Client build test (ensures Vite can compile)

### CI Status Rules
- A Pull Request cannot be merged if CI fails.
- Feature branches should be tested locally before opening a PR.
- Fixing CI errors may require updating:
    - package.json
    - missing files
    - broken imports
    - invalid JSON formatting
- Green CI on dev indicates the project is safe to merge into main.

### Setup Instructions
1. Clone the Repository
```
git clone https://github.com/jeremiahrobinson842/CS425-NetworkGameShow
cd NetworkGameShow
```

### Backend Setup (server/)
2. Install Dependencies
```
cd server
npm install
```

3. Environment Variables

Create server/.env:

```
PG_USER=postgres
PG_PASSWORD="your-password"
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=network_game_show
NODE_ENV=development
PORT=4000
```

Ensure passwords with special characters are inside quotes.

### Database Setup
4. Create Database

In PowerShell:
```
psql -U postgres
```

Inside psql:
```
CREATE DATABASE network_game_show;
\c network_game_show;
```
5. Run Schema
```
\i 'C:/path/to/sql/schema.sql'
```
6. Seed Questions
```
\i 'C:/path/to/sql/seed_questions.sql'
```

You should see:
```
SELECT COUNT(*) FROM questions;
 count 
-------
   25
```

### Frontend Setup (client/)
7. Install Dependencies
```
cd client
npm install
```

8. Start Frontend
```
npm run dev
```

Local dev server:
```
http://localhost:5173
```

### Running the Full Application
1. Start Backend
```
cd server
npm run dev
```

2. Start Frontend
```
cd client
npm run dev
```

The frontend automatically connects to:
```
http://localhost:4000
```

### Testing Procedures
#### Backend API Tests (Powershell)

Health Check 
```
(Invoke-WebRequest http://localhost:4000/health).Content
```

#### Create Game
```
$body = '{"mode":"classic","questionCount":10,"timePerQuestion":20}'
Invoke-WebRequest -Method POST `
  -Uri http://localhost:4000/api/games/create `
  -ContentType "application/json" `
  -Body $body | Select-Object -ExpandProperty Content
```

#### Random Questions
```
(Invoke-WebRequest "http://localhost:4000/api/questions/random?count=5").Content
```

### Real-Time WebSocket Testing
1. Open frontend twice
- One tab for Host
- One tab for Player

2. Host creates game
- Server logs show creation
- Host enters WebSocket room

3. Player joins game
- Server logs player_joined
- Host lobby updates instantly

4. Host presses Start Game
- Both clients see synchronized countdown
- Both receive same question at the same time
- Timer matches server’s timestamp

Everything in Week 2 objectives has been verified and is functional.

### Week 1 Progress Summary:

- Github repo + branch strategy
- Github Actions CI
- Node/Express backend skeleton
- React/Vite frontend scaffold
- PostgreSQL schema + seed
- API routes implemented & tested
- 25-question database seeded
- Wireframes created
- All local & CI tests passing

### Week 2 Progress Summary:

- Socket.io backend integration
- Socket.io frontend integration
- Room management
- Host lobby & player lobby
- Real-time join/leave updates
- Game start countdown
- Real-time synchronized questions
- Server-driven timers
- Working Host and Player flows

### Contribution Guidelines
#### Creating a Feature Branch
```
git checkout <branch-name>
git pull
git checkout -b <branch-name>
```

#### Committing Work
```
git add .
git commit -m "Short description of feature or fix"
```

#### Pushing
```
git push -u origin <branch-name>
```

### Merging
#### Merging with permanent user branch
```
git checkout <user-branch>
git merge <branch-name>
git push
```

#### Merging with dev branch
```
git checkout dev
git merge <user-branch>
git push
```
Test the dev branch for full functionality prior to merging with `main` branch

#### Merging with main branch
Resolve all conflicts if necessary
```
git checkout main
git merge dev
git push
```

#### Remove task branch
Only remove once updates are merged with main and functionality is verified via testing and CI
```
git branch -d <branch-name>
git push origin --delete <branch-name>
```
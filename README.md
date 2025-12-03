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

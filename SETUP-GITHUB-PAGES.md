# VNTR Clicker Studio — GitHub Pages

1. Push the project to your GitHub repository.
2. Open **Settings → Pages**.
3. Under Build and deployment, choose **GitHub Actions**.
4. Push to `main` or manually run **Deploy VNTR Clicker Studio** from Actions.
5. GitHub Pages will publish the site at:
   `https://vntrarts.github.io/VNTR-Clicker-Studio/`

The workflow installs Node 20 dependencies, runs `npm run build`, uploads the Vite `dist` directory, and deploys it with the official Pages actions.
export async function loadAndProcessData() {
    try {
        const [projectsIndex, skillsIndex] = await Promise.all([
            fetch('data/projects.json').then(res => res.ok ? res.json() : Promise.reject(res)),
            fetch('data/skills.json').then(res => res.ok ? res.json() : Promise.reject(res))
        ]);

        const majorProjectPromises = projectsIndex.major.map(url => fetch(url).then(res => res.ok ? res.json() : Promise.reject(res)));
        const smallProjectPromises = projectsIndex.small.map(url => fetch(url).then(res => res.ok ? res.json() : Promise.reject(res)));
        const skillGroupPromises = skillsIndex.map(url => fetch(url).then(res => res.ok ? res.json() : Promise.reject(res)));

        const baseProjectImagePath = 'https://aadhavsivakumar.github.io/Images/projectcovers/';
        const baseProjectPdfPath = 'https://aadhavsivakumar.github.io/projectpdf/';

        const processProjectData = (projects) => {
            if (!projects) return [];
            return projects.map(p => {
                const project = { ...p };
                if (project.imageFile) {
                    project.imageUrl = baseProjectImagePath + project.imageFile;
                }
                if (project.modalContent) {
                    project.modalContent = project.modalContent.map(item => {
                        if (item.type === 'embed' && item.file) {
                            return { ...item, value: baseProjectPdfPath + item.file };
                        }
                        return item;
                    });
                }
                return project;
            });
        };

        const [
            aboutMeData,
            resumeData,
            skillGroupsData,
            majorProjectsData,
            smallProjectsData,
        ] = await Promise.all([
            fetch('data/about.json').then(res => res.ok ? res.json() : Promise.reject(res)),
            fetch('data/resume.json').then(res => res.ok ? res.json() : Promise.reject(res)),
            Promise.all(skillGroupPromises),
            Promise.all(majorProjectPromises).then(processProjectData),
            Promise.all(smallProjectPromises).then(processProjectData),
        ]);

        return {
            aboutMeData,
            majorProjectsData,
            smallProjectsData,
            resumeData,
            skillGroupsData,
        };
    } catch (error) {
        console.error("Failed to load portfolio data:", error);
        return null;
    }
}

// GitHub Release Integration for Enclosure Pro

(async function() {
    const GITHUB_USER = 'timsamoff';
    const GITHUB_REPO = 'enclosure-pro';
    
    try {
        // Fetch all releases
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/releases`
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch releases');
        }
        
        const releases = await response.json();
        
        // Calculate total downloads across all releases
        const totalDownloads = releases.reduce((total, release) => {
            const releaseDownloads = release.assets.reduce((sum, asset) => 
                sum + asset.download_count, 0);
            return total + releaseDownloads;
        }, 0);
        
        // Update the download count in the heading
        const downloadsHeading = document.querySelector('section h2:has(i.fa-download)');
        if (downloadsHeading) {
            // Create a subtle span for the download count
            const countSpan = document.createElement('span');
            countSpan.style.fontSize = '0.6em';
            countSpan.style.fontWeight = 'normal';
            countSpan.style.color = '#666';
            countSpan.style.marginLeft = '10px';
            countSpan.textContent = `(${totalDownloads.toLocaleString()} total downloads)`;
            downloadsHeading.appendChild(countSpan);
        }
        
        // Get the latest release
        const latestRelease = releases[0];
        if (!latestRelease) {
            console.warn('No releases found');
            return;
        }
        
        // Find the specific assets we need - using more specific patterns
        const windowsAsset = latestRelease.assets.find(asset => 
            asset.name.includes('Setup') && asset.name.endsWith('.exe')
        );
        const macAsset = latestRelease.assets.find(asset => 
            asset.name.endsWith('.dmg')
        );
        const linuxAsset = latestRelease.assets.find(asset => 
            asset.name.endsWith('.AppImage')
        );
        
        // Helper function to format file size
        function formatFileSize(bytes) {
            return Math.round(bytes / (1024 * 1024)) + ' MB';
        }
        
        // Update Windows download link
        if (windowsAsset) {
            const windowsLink = document.querySelector('.downloads-list li:nth-child(1) a');
            if (windowsLink) {
                windowsLink.href = windowsAsset.browser_download_url;
                const smallText = windowsLink.querySelector('small');
                if (smallText) {
                    smallText.textContent = `${latestRelease.tag_name} | EXE (${formatFileSize(windowsAsset.size)})`;
                }
            }
        }
        
        // Update Mac download link
        if (macAsset) {
            const macLink = document.querySelector('.downloads-list li:nth-child(2) a');
            if (macLink) {
                macLink.href = macAsset.browser_download_url;
                const smallText = macLink.querySelector('small');
                if (smallText) {
                    smallText.textContent = `${latestRelease.tag_name} | DMG (${formatFileSize(macAsset.size)})`;
                }
            }
        }
        
        // Update Linux download link
        if (linuxAsset) {
            const linuxLink = document.querySelector('.downloads-list li:nth-child(3) a');
            if (linuxLink) {
                linuxLink.href = linuxAsset.browser_download_url;
                const smallText = linuxLink.querySelector('small');
                if (smallText) {
                    smallText.textContent = `${latestRelease.tag_name} | AppImage (${formatFileSize(linuxAsset.size)})`;
                }
            }
        }
        
    } catch (error) {
        console.error('Error loading GitHub release data:', error);
        // Silently fail - the page will still work with the hardcoded links
    }
})();
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const loader = document.getElementById('loader');
    const result = document.getElementById('result');

    
    const antiInspect = () => {
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && (e.key === 'I' || e.key === 'i' || e.key === 'U' || e.key === 'u' || e.key === 'C' || e.key === 'c')) {
                e.preventDefault();
            }
        });
    };
    antiInspect();

    
    document.addEventListener('paste', async (e) => {
        e.preventDefault();
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.indexOf('image') === 0) {
                const file = item.getAsFile();
                if (isValidFileType(file)) {
                    await processFile(file);
                } else {
                    showResult('Please paste only PNG or JPG images', false);
                }
            }
        }
    });

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.style.borderColor = '#bb86fc';
    });
    dropZone.addEventListener('dragleave', e => {
        e.preventDefault();
        dropZone.style.borderColor = '#bb86fc';
    });
    dropZone.addEventListener('drop', handleFile);
    fileInput.addEventListener('change', handleFile);

    function isValidFileType(file) {
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        return validTypes.includes(file.type);
    }

    async function handleFile(e) {
        e.preventDefault();
        const file = e.target.files?.[0] || e.dataTransfer?.files[0];
        
        if (!file || !file.type.startsWith('image/')) {
            showResult('Please upload an image file', false);
            return;
        }

        if (!isValidFileType(file)) {
            showResult('Please upload only PNG or JPG images', false);
            return;
        }

        await processFile(file);
    }

    async function processFile(file) {
        const formData = new FormData();
        formData.append('image', file);

        
        const urlParams = new URLSearchParams(window.location.search);
        const userid = urlParams.get('userid');
        const token = urlParams.get('token');

        Swal.fire({
            title: 'Checking...',
            html: 'Processing your screenshot',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            },
            background: '#1a1a1a',
            color: '#fff'
        });

        try {
            const response = await fetch(`/check-subscription?userid=${userid}&token=${token}`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (data.banned) {
                showResult('You have been banned for using fake screenshots ❌', false, {
                    isSubscribed: false,
                    details: {
                        subscriptionFound: false,
                        channelFound: false,
                        banned: true
                    }
                });
                
                setTimeout(() => {
                    window.location.href = 'about:blank';
                }, 3000);
                return;
            }

            if (data.success) {
                if (data.isSubscribed && data.channelName === 'Krex') {
                    showResult('Verified Krex subscriber! ✅', true, data);
                    
                    if (data.sessionTerminated) {
                        setTimeout(() => {
                            window.location.href = 'about:blank';
                        }, 3000);
                    }
                } else {
                    showResult('Not subscribed to Krex ❌', false, data);
                }
            } else {
                showResult('Verification failed', false);
            }
        } catch (error) {
            showResult('Error processing image', false);
        }
    }

    function showResult(message, isSuccess, details = null) {
        const iconHtml = isSuccess ? `
            <svg class="animate-success-svg" viewBox="0 0 70 70">
                <circle class="success-circle" cx="35" cy="35" r="30"/>
                <path class="success-check" d="M20 35 l10 10 l20 -20"/>
            </svg>
        ` : `
            <svg class="animate-error-svg" viewBox="0 0 70 70">
                <circle class="error-circle" cx="35" cy="35" r="30"/>
                <path class="error-x" d="M25 25 l20 20 M45 25 l-20 20"/>
            </svg>
        `;

        const getStatusMessage = (type, verified, found) => {
            if (type === 'like') {
                if (verified) return '✅ Like Verified';
                if (found) return '❌ Like button found but not active';
                return '❌ Please show the filled like button in screenshot';
            }
            if (type === 'comment') {
                if (verified) return '✅ Comment Verified';
                if (found) return '❌ Comment box found but no comment';
                return '❌ Please show your comment in the screenshot';
            }
        };

        const statusList = details ? `
            <div class="verification-status">
                ${details.details?.banned ? 
                    `<div class="status-item error">
                        ❌ Account Blacklisted - Using Fake Screenshots
                        <br><small>(This session will be terminated...)</small>
                    </div>` :
                    `${details.isSubscribed ? 
                        `<div class="status-item success">✅ Verified Krex Subscriber</div>` :
                        `<div class="status-item error">
                            ${details.details?.subscriptionFound ? 
                                (details.details?.channelFound ? 
                                    '❌ Verification Failed' : 
                                    '❌ Krex Channel Not Found') :
                                '❌ Subscription Not Found'}
                        </div>`
                    }
                    ${details.requirements?.like ? `
                        <div class="status-item ${details.likeVerified ? 'success' : 'error'}">
                            ${details.likeVerified ? '✅ Like Verified' : '❌ Like Required'}
                        </div>
                    ` : ''}`
                }
            </div>
        ` : '';

        Swal.fire({
            html: `
                <div class="custom-swal-container">
                    <div class="custom-icon">${iconHtml}</div>
                    <h2 class="custom-title">${isSuccess ? 'Success!' : 'Error'}</h2>
                    <p class="custom-message">${message}</p>
                    ${statusList}
                </div>
            `,
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: '#1a1a1a',
            customClass: {
                popup: 'rounded-xl border border-purple-500/10 custom-popup',
                container: 'custom-container',
                title: 'text-white',
                htmlContainer: 'text-gray-300'
            },
            showClass: {
                popup: 'animate__animated animate__fadeInDown'
            },
            hideClass: {
                popup: 'animate__animated animate__fadeOutUp'
            }
        });
    }
});

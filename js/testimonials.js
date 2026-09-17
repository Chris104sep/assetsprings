// ============================================================
// TESTIMONIALS — USER SUBMISSION
// ============================================================
// Any authenticated user can submit a testimonial from their Profile page.
// It is created with status = pending and only becomes publicly visible
// once a super admin approves it (see admin.js for the review workflow).

function showSubmitTestimonialModal() {
    document.getElementById('submit-testimonial-form').reset();
    openModal('submit-testimonial-modal');
}

async function handleSubmitTestimonial(event) {
    event.preventDefault();

    const message = document.getElementById('submit-testimonial-message').value.trim();
    const btn = event.target.querySelector('button[type="submit"]');

    if (!message) {
        UI.showToast('Please enter your testimonial', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
        const result = await Api.createTestimonial({ testimonial: message });

        if (result.success) {
            UI.showToast('Thank you! Your testimonial has been submitted for review.', 'success');
            closeModal('submit-testimonial-modal');
        } else {
            UI.showToast(result.message || 'Failed to submit testimonial', 'error');
        }
    } catch (error) {
        console.error('Submit testimonial error:', error);
        UI.showToast('Error submitting testimonial', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit for Review';
    }
}

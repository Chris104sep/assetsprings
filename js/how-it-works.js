// ============================================================
// HOW IT WORKS
// ============================================================
// A single reusable modal, populated per-section. Content here describes
// only processes that actually exist in the app — nothing invented.

const HOW_IT_WORKS_CONTENT = {
    dashboard: {
        title: 'How Your Dashboard Works',
        steps: [
            'Your <strong>Available Balance</strong> is the money in your account that is not currently locked into a savings goal — you can use it to fund savings goals or request a withdrawal.',
            'Your <strong>Savings</strong> total is money you have already transferred into savings goals. It is tracked separately from your available balance so the same funds are never counted twice.',
            'Deposits, withdrawals, investments and savings transfers you make all show up here as stats and in your recent transactions.',
            'Pending items (like a deposit awaiting approval) are not reflected in your available balance until they are approved.'
        ]
    },
    deposits: {
        title: 'How Deposits Work',
        steps: [
            'Copy the platform\'s wallet address shown in the deposit form.',
            'Send your funds to that wallet address using the selected cryptocurrency and network.',
            'Submit your deposit details, including the transaction hash and any proof of payment.',
            'Wait for your deposit to be reviewed and approved by our team.',
            'Once approved, the funds appear in your available balance and can be used for savings goals, investments, or withdrawals.'
        ]
    },
    withdrawals: {
        title: 'How Withdrawals Work',
        steps: [
            'Request a withdrawal by entering the amount, the cryptocurrency/network, and the wallet address you want the funds sent to.',
            'Your withdrawal request is submitted with a status of Pending.',
            'Our team reviews and either approves or rejects the request.',
            'Once approved, funds are sent to the wallet address you provided and your available balance is updated accordingly.'
        ]
    },
    investments: {
        title: 'How Investments Work',
        steps: [
            'Browse the available investment plans, each with its own minimum/maximum amount, duration, and expected return.',
            'Choose a plan and enter the amount you want to invest.',
            'Your investment is created and tracked on your Investments page, showing its status and expected return.',
            'Investment funding follows the platform\'s existing deposit/balance rules — check with support for plan-specific terms.'
        ]
    },
    savings: {
        title: 'How Savings Goals Work',
        steps: [
            'Create a savings goal with a name, a target amount, and a target date.',
            'Deposit funds into your platform balance (see "How Deposits Work").',
            'Click <strong>Add Funds</strong> and select the savings goal you want to fund.',
            'Choose how much of your available balance to move into that goal — you can transfer part of it or all of it.',
            'Confirm the transfer. The amount is deducted from your available balance and added to the savings goal immediately — it is never counted in both places at once.'
        ]
    },
    transactions: {
        title: 'How Transactions Work',
        steps: [
            'Every deposit, withdrawal, investment, and savings transfer you make is recorded here as a transaction.',
            'Use the filter to narrow the list down to a specific transaction type.',
            'Each entry shows the amount, type, date, and status so you can track exactly what happened to your funds and when.'
        ]
    }
};

function showHowItWorks(section) {
    const content = HOW_IT_WORKS_CONTENT[section];
    if (!content) return;

    document.getElementById('how-it-works-title').textContent = content.title;
    document.getElementById('how-it-works-body').innerHTML = content.steps
        .map(step => `<li>${step}</li>`)
        .join('');

    openModal('how-it-works-modal');
}

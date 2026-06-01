"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateHealthScore = calculateHealthScore;
function calculateHealthScore(data) {
    let score = 0;
    // Stars (0-40 points)
    if (data.stars !== null) {
        if (data.stars > 50000)
            score += 40;
        else if (data.stars > 10000)
            score += 30;
        else if (data.stars > 1000)
            score += 20;
        else if (data.stars > 100)
            score += 10;
    }
    // Recent activity (0-30 points)
    if (data.lastCommitAt) {
        const daysSinceCommit = (Date.now() - data.lastCommitAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCommit < 7)
            score += 30;
        else if (daysSinceCommit < 30)
            score += 20;
        else if (daysSinceCommit < 90)
            score += 10;
    }
    // License (0-20 points)
    const permissiveLicenses = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause'];
    if (data.licenseSpdx && permissiveLicenses.includes(data.licenseSpdx)) {
        score += 20;
    }
    else if (data.licenseSpdx) {
        score += 10;
    }
    // Archived penalty (-10 points)
    if (data.archived)
        score -= 10;
    return Math.max(0, Math.min(100, score));
}

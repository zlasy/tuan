const assignmentList = document.querySelector('#assignment-list');
const assignmentSubjects = [...assignmentList.children];
const assignmentTasks = new Map(assignmentSubjects.map(subject => [subject, [...subject.querySelectorAll('.task')]]));

function sortAssignments() {
  const done = task => task.querySelector('.check').checked;
  for (const subject of assignmentSubjects) {
    subject.querySelector('.subject-head').after(...[...assignmentTasks.get(subject)].sort((a, b) => Number(done(a)) - Number(done(b))));
  }
  const complete = subject => assignmentTasks.get(subject).every(done);
  assignmentList.append(...[...assignmentSubjects].sort((a, b) => Number(complete(a)) - Number(complete(b))));
}

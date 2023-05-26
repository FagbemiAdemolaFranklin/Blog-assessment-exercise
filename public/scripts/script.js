document.querySelector("#create-blog-button").addEventListener("click", function() {
    document.querySelector(".create-blogs-form").classList.toggle("open-create-form")
})

document.querySelectorAll("#comments").forEach(function(clicked, indexClicked){
    clicked.addEventListener("click", () => {
       document.querySelectorAll(".comments")[indexClicked].classList.toggle("open-comments");
    })
})


